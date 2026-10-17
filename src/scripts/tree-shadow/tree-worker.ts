// Grows the tree texture off the main thread (it takes a moment, and would
// otherwise freeze the page). Replies with the tree and depth textures as
// ImageBitmaps, flipped for WebGL, and the crown position.
// @ts-expect-error: plain JS copied from the artifact
import { buildTree } from './engine.js';

self.onmessage = async (e: MessageEvent<{ type: string; seed: number; rotY: number; rotX: number }>) => {
  const { type, seed, rotY, rotX } = e.data;
  const tree = buildTree(type, seed, rotY, rotX);
  const flip = { imageOrientation: 'flipY' } as const;
  const [treeBmp, depthBmp] = await Promise.all([createImageBitmap(tree, flip), createImageBitmap(tree.depth, flip)]);
  (self as unknown as Worker).postMessage({ tree: treeBmp, depth: depthBmp, crown: tree.crown || null }, [treeBmp, depthBmp]);
};
