// mg-segment-worker.js — runs mg-slic.js's segmentation + sky-detection inside a Web Worker, off
// the main thread, so the ~0.3-2.5s it takes on a phone (see mg-slic.js's own notes) never freezes
// the page or the photo the customer is looking at. The main thread sends an ImageData-shaped
// payload (width/height/a plain array of pixel bytes, since ImageData itself isn't always
// structured-cloneable the same way across browsers) and gets back {labels, numSegments, skyIds}.
importScripts('mg-slic.js');

self.onmessage = function (e) {
  var msg = e.data;
  if (msg.type !== 'segment') return;
  try {
    var imageData = { width: msg.width, height: msg.height, data: new Uint8ClampedArray(msg.pixels) };
    var result = MGSlic.segment(imageData, { numSegments: msg.numSegments, compactness: msg.compactness, maxIter: msg.maxIter || 10 });
    var skyIds = MGSlic.detectSky(imageData, result.labels, result.numSegments);
    // Transfer the labels buffer back (zero-copy) instead of cloning it.
    self.postMessage({
      type: 'done', labels: result.labels, numSegments: result.numSegments, skyIds: skyIds
    }, [result.labels.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.message || err) });
  }
};
