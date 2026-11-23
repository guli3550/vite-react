/* GULI chat media metadata helper.
   Primary upload, storage signing, offline queuing, and normalization are handled directly by chatSync.ts. */
(function () {
  // No duplicate window.fetch wrapping or localStorage rewrite loops needed.
  if (typeof window !== "undefined") {
    window.__guliChatMediaBridgeReady = true;
  }
})();
