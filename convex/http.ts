import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { renderComplete, renderFail } from "./renderWebhook";

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({ path: "/render-complete", method: "POST", handler: renderComplete });
http.route({ path: "/render-fail", method: "POST", handler: renderFail });

export default http;
