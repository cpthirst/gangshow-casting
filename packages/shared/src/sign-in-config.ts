import { z } from "zod";

const httpsUrl = z.url({ protocol: /^https$/ });

/**
 * Where the hosted pages sign people in (ADR 0018). The deploy writes it to /config.json,
 * as the app's own address is only known once the stack is deployed.
 */
export const SignInConfig = z.object({
  clientId: z.string().min(1),
  /** The user pool's token issuer. */
  issuer: httpsUrl,
  /** Cognito's managed login, on the pool's prefix domain. */
  loginUrl: httpsUrl,
  /** The app's own address: where sign-in and sign-out return to. */
  appUrl: httpsUrl,
});

export type SignInConfig = z.infer<typeof SignInConfig>;
