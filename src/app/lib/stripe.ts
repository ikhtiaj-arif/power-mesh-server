import Stripe from "stripe";
import config from "../config";

let stripeClient: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!config.stripe_secret_key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  stripeClient ??= new Stripe(config.stripe_secret_key);

  return stripeClient;
};

export const isStripeConfigured = () =>
  Boolean(config.stripe_secret_key && config.stripe_webhook_secret);
