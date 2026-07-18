import http from "node:http";
import https from "node:https";
import tls from "node:tls";

function proxyAuthorization(proxy) {
  if (!proxy.username) return "";
  return `Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString("base64")}`;
}

function responseFrom(stream, status) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      resolve({
        status,
        ok: status >= 200 && status < 300,
        text: async () => body,
        json: async () => JSON.parse(body)
      });
    });
    stream.on("error", reject);
  });
}

function requestThroughProxy(target, init, proxy) {
  return new Promise((resolve, reject) => {
    const authorization = proxyAuthorization(proxy);
    const proxyTransport = proxy.protocol === "https:" ? https : http;
    const connect = proxyTransport.request({
      host: proxy.hostname,
      port: Number(proxy.port || 80),
      method: "CONNECT",
      path: `${target.hostname}:${target.port || 443}`,
      headers: {
        Host: `${target.hostname}:${target.port || 443}`,
        ...(authorization ? { "Proxy-Authorization": authorization } : {})
      }
    });

    connect.once("connect", (response, socket, head) => {
      if (response.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`Proxy CONNECT failed with status ${response.statusCode}`));
        return;
      }

      if (head.length) socket.unshift(head);
      const secureSocket = tls.connect({ socket, servername: target.hostname });
      secureSocket.once("error", reject);
      secureSocket.once("secureConnect", () => {
        const tunnelAgent = new https.Agent({ keepAlive: false });
        // https.Agent expects this callback when its connection is supplied by
        // a pre-established CONNECT tunnel. Returning the socket alone leaves
        // some Node versions waiting for a connection that has already opened.
        tunnelAgent.createConnection = (_options, callback) => {
          if (callback) callback(null, secureSocket);
          return secureSocket;
        };
        const request = https.request(target, {
          method: init?.method ?? "GET",
          headers: init?.headers,
          agent: tunnelAgent
        }, (responseStream) => {
          responseFrom(responseStream, responseStream.statusCode ?? 0)
            .then(resolve, reject)
            .finally(() => tunnelAgent.destroy());
        });
        request.once("error", reject);
        request.setTimeout(30_000, () => {
          request.destroy(new Error("YouTube request timed out after 30 seconds."));
        });
        if (init?.body) request.write(init.body);
        request.end();
      });
    });
    connect.once("error", reject);
    connect.end();
  });
}

export function createYoutubeFetch(proxyUrl = process.env.YOUTUBE_PROXY_URL) {
  if (process.env.YOUTUBE_DISABLE_PROXY === "1") return fetch;
  if (!proxyUrl) return fetch;

  const proxy = new URL(proxyUrl);
  if (!["http:", "https:"].includes(proxy.protocol)) {
    throw new Error("YOUTUBE_PROXY_URL must use the http:// or https:// scheme.");
  }

  return async (input, init = {}) => {
    const target = new URL(input instanceof URL ? input.href : input);
    if (target.protocol !== "https:") {
      throw new Error("The proxy adapter only supports HTTPS target URLs.");
    }
    return requestThroughProxy(target, init, proxy);
  };
}
