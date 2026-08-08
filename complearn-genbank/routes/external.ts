import express, {Request, Response} from "express";
import axios from "axios";
import logger from "../configurations/logger";
import {isGenbankHostname} from "../genbank/genbankUtils";
import {
  NcbiQueueFullError,
  ncbiRequestScheduler,
  prepareNcbiUrl,
} from "../genbank/ncbiClient";

const router = express.Router();

router.post("/forward", async (req: Request, res: Response): Promise<any> => {
  try {
    const externalUrl = typeof req.body?.externalUrl === "string" ? req.body.externalUrl : "";
    if (!externalUrl) return res.status(400).json({error: "Target URL is required"});

    const parsedUrl = new URL(externalUrl);
    if (!isGenbankHostname(parsedUrl.hostname)) {
      return res.status(400).json({error: "Target host is not allowed"});
    }
    if (parsedUrl.hostname !== "eutils.ncbi.nlm.nih.gov") {
      return res.status(400).json({error: "This endpoint only proxies NCBI E-utilities requests"});
    }

    const safeUrl = prepareNcbiUrl(externalUrl);
    logger.info({requestId: req.requestId, message: "Forwarding NCBI E-utilities request", path: parsedUrl.pathname});
    const response = await ncbiRequestScheduler.request({
      url: safeUrl,
      method: "GET",
      responseType: "text",
      transformResponse: [(value: string) => value],
      validateStatus: status => status >= 200 && status < 300,
    });

    const expectsJson = parsedUrl.searchParams.get("retmode") === "json";
    if (expectsJson) {
      try {
        return res.status(response.status).json(JSON.parse(String(response.data)));
      } catch {
        return res.status(502).json({error: "NCBI returned malformed JSON."});
      }
    }
    return res.status(response.status).type("text/plain").send(response.data);
  } catch (error) {
    if (error instanceof NcbiQueueFullError) return res.status(503).json({error: error.message});
    if (axios.isAxiosError(error)) {
      const upstreamStatus = error.response?.status;
      logger.warn({requestId: req.requestId, message: "NCBI request failed", upstreamStatus});
      return res.status(upstreamStatus === 429 ? 429 : 502).json({
        error: upstreamStatus === 429
          ? "NCBI is rate limiting requests. Try again shortly."
          : "NCBI is temporarily unavailable.",
      });
    }
    logger.warn({requestId: req.requestId, message: "Rejected external request", error: String(error)});
    return res.status(400).json({error: "Invalid external request"});
  }
});

export default router;
