/**
 * ROLLTIME cam.js — engine kamera (getUserMedia + fx renderer)
 * Dipakai oleh halaman camera (tamu event) & booth (photobooth).
 */
import { createRenderer, renderOnce, stampOverlay } from './fx.js';

export class CameraEngine {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.renderer = createRenderer(canvasEl);
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.stream = null;
    this.facing = 'environment';
    this.mirror = false;
    this.effectId = 1;
    this.running = false;
    this._raf = null;
    this.onError = null;
  }

  async start(facing = 'environment') {
    this.stopStream();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
    } catch (e) {
      // fallback: kamera apa pun yang ada (beberapa HP menolak facingMode exact)
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (e2) {
        if (this.onError) this.onError(e2);
        return false;
      }
    }
    this.facing = facing;
    this.mirror = facing === 'user';
    this.video.srcObject = this.stream;
    try { await this.video.play(); } catch (e) { /* autoplay quirks */ }
    this.running = true;
    this._loop();
    return true;
  }

  _loop() {
    if (!this.running) return;
    if (this.renderer && this.video.readyState >= 2) {
      this.renderer.render(this.video, this.effectId, this.mirror);
    }
    this._raf = requestAnimationFrame(() => this._loop());
  }

  setEffect(id) { this.effectId = id; }

  async switchCamera() {
    const next = this.facing === 'environment' ? 'user' : 'environment';
    const okStart = await this.start(next);
    if (!okStart) await this.start('environment');
  }

  /** Ambil 1 frame final: render full-res + overlay stamp → blob JPEG. */
  async capture({ stamp = true, frame = null } = {}) {
    const srcCanvas = this.canvas; // sudah full-res karena renderer sync ukuran video
    let out = srcCanvas;
    if (stamp) {
      out = document.createElement('canvas');
      out.width = srcCanvas.width; out.height = srcCanvas.height;
      const ctx = out.getContext('2d');
      ctx.drawImage(srcCanvas, 0, 0);
      stampOverlay(out, { date: new Date(), frame, effectId: this.effectId });
    }
    const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.92));
    return { blob, canvas: out };
  }

  /** Render sebuah File dari galeri lewat efek yang sama (upload bypass kamera). */
  async captureFromImage(imgEl, opts = {}) {
    const c = await renderOnce(imgEl, this.effectId, false);
    if (opts.stamp !== false) stampOverlay(c, { date: new Date(), frame: opts.frame ?? null, effectId: this.effectId });
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    return { blob, canvas: c };
  }

  stopStream() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
  }
  destroy() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.stopStream();
  }
}

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
