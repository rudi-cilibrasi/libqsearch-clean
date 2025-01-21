import express, { Request, Response } from "express";
import axios from "axios";
import ENV_LOADER from "../configurations/envLoader";
import logger from "../configurations/logger";
import {
  addApiKey,
  GenBankHostName,
  isGenbankHostname,
} from "../genbank/genbankUtils";
import { clURL } from "../commonTypes/clURL";

const router = express.Router();

let apiKeyIndex = 0;

const apiKeys = [
  ENV_LOADER.GENBANK_API_KEY_1,
  ENV_LOADER.GENBANK_API_KEY_2,
  ENV_LOADER.GENBANK_API_KEY_3,
];

function getNextApiKey() {
  const apiKey = apiKeys[apiKeyIndex];
  apiKeyIndex = (apiKeyIndex + 1) % apiKeys.length;
  return apiKey;
}

router.post("/forward", async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      externalUrl = "",
      method = "GET",
      body = null,
      responseType = "json",
      responseHeaders = {},
    } = req.body;

    if (!externalUrl) {
      return res.status(400).send({ error: "Target URL is required" });
    }

    const parsedUrl = new URL(externalUrl);
    console.log("hostname: " + parsedUrl.hostname);
    if (!isGenbankHostname(parsedUrl.hostname as GenBankHostName)) {
      throw new Error(`Invalid hostname: ${parsedUrl.hostname}`);
    }
    const urlWithApiKey: clURL = addApiKey(
      "GET",
      parsedUrl.toString() as clURL,
      getNextApiKey()
    );

    Object.entries(responseHeaders).forEach(([key, value]: [any, any]) => {
      res.setHeader(key, value);
    });
    logger.info(`Forwarding request to ${parsedUrl.toString()}`);
    const axiosParams = {
      url: urlWithApiKey,
      method: method,
      data: body,
      responseType: responseType,
    };
    console.log("Params: " + JSON.stringify(axiosParams));
    const response = await axios(axiosParams);

    res.status(response.status);
    if (responseType === "stream") {
      response.data.pipe(res);
    } else {
      res.send(response.data);
    }
  } catch (error) {
    logger.error(`Error in forwarding request: ${error}`);
    res.status(500).send({ error: error });
  }
});

export default router;
