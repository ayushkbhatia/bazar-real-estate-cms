import { Received } from "../_steps/received";

/**
 * W4 · Request received (consultancy) and W7 · Application received
 * (pre-approval): one route, the submitted service decides which renders.
 * Session-bound: the reference and contact details come from this tab's
 * storage, never the URL.
 */
export default function ReceivedPage() {
  return <Received />;
}
