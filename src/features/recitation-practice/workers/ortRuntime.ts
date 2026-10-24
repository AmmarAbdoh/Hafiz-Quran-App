/*
 * Where transformers.js should find the ONNX runtime.
 *
 * It points these at a CDN the app's connect-src does not allow, so the
 * Whisper worker overrides them with the files Vite emits from our own
 * dependency - and the version it is given has to be the one transformers
 * was built against, which is why `onnxruntime-web` is pinned exactly and
 * overridden for the whole tree in package.json.
 *
 * Only that worker needs this. The streaming worker drives onnxruntime-web
 * directly and resolves its own wasm, so the comment that used to be here -
 * one asset shared by both workers - described an arrangement that no longer
 * exists. It is kept as a module because it is where the pinning is
 * explained, and it goes when Whisper does.
 */
import runtimeUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";

export const ORT_WASM_PATHS = { mjs: runtimeUrl, wasm: wasmUrl };
