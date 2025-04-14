import express, { Request, RequestHandler, Response, Router } from "express";
import logger from "../configurations/logger";
import ENV_LOADER from "../configurations/envLoader";

const router: Router = express.Router();

// Interface for Datatrans webhook payload
interface DatatransWebhookPayload {
  transactionId: string;
  merchantId: string;
  type: string;
  status: string;
  currency: string;
  refno: string;
  paymentMethod: string;
  detail: {
    authorize?: {
      amount: number;
      acquirerAuthorizationCode: string;
    };
    settle?: {
      amount: number;
    };
    cancel?: {
      amount: number;
    };
  };
  card?: {
    alias: string;
    masked: string;
    expiryMonth: string;
    expiryYear: string;
    info: {
      brand: string;
      type: string;
      usage: string;
      country: string;
      issuer: string;
    };
    "3D"?: {
      authenticationResponse: string;
    };
  };
  history: Array<{
    action: string;
    amount: number;
    source: string;
    date: string;
    success: boolean;
    ip: string;
  }>;
  [key: string]: any; // For any additional fields
}

// Helper function to validate webhook signature if Datatrans provides one
const validateWebhookSignature = (
  payload: any,
  signature: string,
  secret: string
): boolean => {
  // Implement signature validation if Datatrans provides one
  // This is a placeholder - check Datatrans documentation for exact validation method
  // Example implementation:
  // const calculatedSignature = crypto
  //   .createHmac('sha256', secret)
  //   .update(JSON.stringify(payload))
  //   .digest('hex');
  // return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature));

  // For now, return true (no validation)
  return true;
};

// Handler for Datatrans webhook
const datatransWebhookHandler: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const webhookData = req.body as DatatransWebhookPayload;
    logger.info(
      `Received Datatrans webhook for transaction: ${webhookData.transactionId}`
    );

    // Optional: Validate webhook signature if Datatrans provides one
    // const signature = req.headers['x-datatrans-signature'] as string;
    // if (!validateWebhookSignature(webhookData, signature, ENV_LOADER.DATATRANS_WEBHOOK_SECRET)) {
    //     logger.error('Invalid webhook signature');
    //     return res.status(401).json({ error: 'Invalid signature' });
    // }

    // Generate Redis key for storing transaction data
    const transactionKey = `datatrans:transaction:${webhookData.transactionId}`;

    // Store the complete transaction data in Redis
    await client.set(transactionKey, JSON.stringify(webhookData));
    logger.info(`Stored transaction data in Redis with key: ${transactionKey}`);

    // Also store a reference by reference number for easier lookup
    if (webhookData.refno) {
      const refnoKey = `datatrans:refno:${webhookData.refno}`;
      await client.set(refnoKey, webhookData.transactionId);
      logger.info(
        `Created reference mapping in Redis: ${refnoKey} -> ${webhookData.transactionId}`
      );
    }

    // Process transaction based on status
    switch (webhookData.status) {
      case "authorized":
        // Handle authorized transaction
        logger.info(
          `Transaction ${webhookData.transactionId} authorized for ${webhookData.detail.authorize?.amount} ${webhookData.currency}`
        );

        // Publish event to a Redis channel for async processing
        await client.publish(
          "datatrans:events",
          JSON.stringify({
            type: "transaction_authorized",
            transactionId: webhookData.transactionId,
            amount: webhookData.detail.authorize?.amount,
            currency: webhookData.currency,
            refno: webhookData.refno,
            timestamp: new Date().toISOString(),
          })
        );
        break;

      case "settled":
        // Handle settled transaction
        logger.info(
          `Transaction ${webhookData.transactionId} settled for ${webhookData.detail.settle?.amount} ${webhookData.currency}`
        );

        // Publish event to a Redis channel for async processing
        await client.publish(
          "datatrans:events",
          JSON.stringify({
            type: "transaction_settled",
            transactionId: webhookData.transactionId,
            amount: webhookData.detail.settle?.amount,
            currency: webhookData.currency,
            refno: webhookData.refno,
            timestamp: new Date().toISOString(),
          })
        );
        break;

      case "canceled":
        // Handle canceled transaction
        logger.info(`Transaction ${webhookData.transactionId} canceled`);

        // Publish event to a Redis channel for async processing
        await client.publish(
          "datatrans:events",
          JSON.stringify({
            type: "transaction_canceled",
            transactionId: webhookData.transactionId,
            refno: webhookData.refno,
            timestamp: new Date().toISOString(),
          })
        );
        break;

      case "failed":
        // Handle failed transaction
        logger.info(`Transaction ${webhookData.transactionId} failed`);

        // Publish event to a Redis channel for async processing
        await client.publish(
          "datatrans:events",
          JSON.stringify({
            type: "transaction_failed",
            transactionId: webhookData.transactionId,
            refno: webhookData.refno,
            timestamp: new Date().toISOString(),
          })
        );
        break;

      default:
        // Handle other statuses
        logger.info(
          `Transaction ${webhookData.transactionId} with status ${webhookData.status}`
        );

        // Publish event to a Redis channel for async processing
        await client.publish(
          "datatrans:events",
          JSON.stringify({
            type: "transaction_other",
            status: webhookData.status,
            transactionId: webhookData.transactionId,
            refno: webhookData.refno,
            timestamp: new Date().toISOString(),
          })
        );
    }

    // Return success status to Datatrans
    // Note: It's important to respond quickly to webhooks
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Error processing Datatrans webhook:", error);

    // Log the raw request body for debugging
    logger.error("Raw webhook data:", req.body);

    // Return 500 error to Datatrans which will trigger a retry
    res.status(500).json({
      error: "Webhook processing failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Endpoint to query transaction data by transaction ID
const getTransactionByIdHandler: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { transactionId } = req.params;
    if (!transactionId) {
      return res.status(400).json({ error: "Transaction ID is required" });
    }

    const transactionKey = `datatrans:transaction:${transactionId}`;
    const transactionData = await client.get(transactionKey);

    if (!transactionData) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({ transaction: JSON.parse(transactionData) });
  } catch (error) {
    logger.error("Error retrieving transaction data:", error);
    res.status(500).json({
      error: "Failed to retrieve transaction data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Endpoint to query transaction data by reference number
const getTransactionByRefnoHandler: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { refno } = req.params;
    if (!refno) {
      return res.status(400).json({ error: "Reference number is required" });
    }

    const refnoKey = `datatrans:refno:${refno}`;
    const transactionId = await client.get(refnoKey);

    if (!transactionId) {
      return res.status(404).json({
        error: "Transaction not found for the given reference number",
      });
    }

    const transactionKey = `datatrans:transaction:${transactionId}`;
    const transactionData = await client.get(transactionKey);

    if (!transactionData) {
      return res.status(404).json({ error: "Transaction data not found" });
    }

    res.json({ transaction: JSON.parse(transactionData) });
  } catch (error) {
    logger.error(
      "Error retrieving transaction data by reference number:",
      error
    );
    res.status(500).json({
      error: "Failed to retrieve transaction data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Register routes
router.post("/", datatransWebhookHandler);
router.get("/transaction/:transactionId", getTransactionByIdHandler);
router.get("/transaction/refno/:refno", getTransactionByRefnoHandler);

export default router;
