/**
 * ROLLTIME fx.js — 15 efek kamera digital/digicam (WebGL)
 * Preview real-time dari <video>, capture full-res via render sekali lagi.
 */

export const EFFECTS = [
  { id: 0,  key: 'original',  chip: '#CFC9BD' },
  { id: 1,  key: 'funsaver',  chip: '#E8B04C' },
  { id: 2,  key: 'quicksnap', chip: '#7FB069' },
  { id: 3,  key: 'portra',    chip: '#E9C9A8' },
  { id: 4,  key: 'ektar',     chip: '#E2502F' },
  { id: 5,  key: 'hp5',       chip: '#5A5A5A' },
  { id: 6,  key: 'cinestill', chip: '#2B6F6D' },
  { id: 7,  key: 'ixus',      chip: '#9DB89A' },
  { id: 8,  key: 'cybershot', chip: '#C35B8F' },
  { id: 9,  key: 'coolpix',   chip: '#C9A675' },
  { id: 10, key: 'easyshare', chip: '#6F8FC9' },
  { id: 11, key: 'finepix',   chip: '#2FA39A' },
  { id: 12, key: 'mju',       chip: '#F0E6D2' },
  { id: 13, key: 'y2k',       chip: '#FFFFFF' },
  { id: 14, key: 'polaroid',  chip: '#EFE3C8' },
];

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main(){
  v_uv = vec2(a_pos.x*0.5+0.5, 0.5-a_pos.y*0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_effect;
uniform float u_time;
uniform vec2 u_res;
uniform float u_mirror;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
vec3 sat(vec3 c, float s){ return mix(vec3(luma(c)), c, s); }
vec3 scurve(vec3 c, float a){ return mix(c, c*c*(3.0-2.0*c), clamp(a,0.0,1.0)); }
vec3 splitTone(vec3 c, vec3 sh, vec3 hi){
  float l = luma(c);
  return c * mix(sh, hi, smoothstep(0.15, 0.85, l));
}
vec3 brightPass(vec2 uv){
  vec3 s = texture2D(u_tex, uv).rgb;
  float l = smoothstep(0.62, 0.95, luma(s));
  return s * l;
}

void main(){
  vec2 uv = v_uv;
  if(u_mirror > 0.5) uv.x = 1.0 - uv.x;

  vec3 c = texture2D(u_tex, uv).rgb;
  float e = u_effect;

  float grain = 0.28;
  float vig = 0.28;
  float haloAmt = 0.0;
  vec3 haloTint = vec3(1.0, 0.55, 0.3);

  if(e < 0.5){                       /* 0 ORIGINAL — bersih */
    grain = 0.06; vig = 0.10;
  }
  else if(e < 1.5){                  /* 1 KODAK FUNSAVER — disposable warm */
    c *= vec3(1.10, 0.99, 0.82);
    c = scurve(c, 0.35);
    c = sat(c, 1.06);
    c = c*0.94 + 0.045;              /* lift blacks ala film */
    grain = 0.42; vig = 0.34;
  }
  else if(e < 2.5){                  /* 2 FUJI QUICKSNAP — hijau segar */
    c *= vec3(0.94, 1.04, 0.96);
    c = splitTone(c, vec3(0.96,1.0,0.98), vec3(1.02,0.99,1.01));
    c = scurve(c, 0.3);
    c = sat(c, 1.08);
    c = c*0.95 + 0.04;
    grain = 0.4; vig = 0.32;
  }
  else if(e < 3.5){                  /* 3 PORTRA 400 — skin tone creamy */
    c *= vec3(1.06, 1.0, 0.94);
    c = scurve(c, 0.18);
    c = sat(c, 0.96);
    c = c*0.92 + 0.055;
    grain = 0.22; vig = 0.18;
  }
  else if(e < 4.5){                  /* 4 EKTAR 100 — saturasi nendang */
    c = sat(c, 1.34);
    c = scurve(c, 0.55);
    c *= vec3(1.07, 0.97, 0.9);
    grain = 0.18; vig = 0.26;
  }
  else if(e < 5.5){                  /* 5 ILFORD HP5+ — B&W gritty */
    float l = luma(c);
    l = pow(l, 1.12);
    c = vec3(l);
    c = scurve(c, 0.6);
    c = c*0.9 + 0.035;
    grain = 0.85; vig = 0.4;
  }
  else if(e < 6.5){                  /* 6 CINESTILL 800T — malam, halation */
    c = splitTone(c, vec3(0.86,0.97,1.12), vec3(1.06,1.0,0.9));
    c = sat(c, 1.12);
    c = scurve(c, 0.3);
    c *= vec3(1.02, 0.99, 1.0);
    grain = 0.5; vig = 0.3;
    haloAmt = 0.55;
  }
  else if(e < 7.5){                  /* 7 CANON IXUS — digicam legend */
    c *= vec3(0.96, 1.03, 0.95);
    c = c*0.98 + 0.045;              /* wash tipis */
    c = sat(c, 1.04);
    c = scurve(c, 0.22);
    grain = 0.3; vig = 0.36;
  }
  else if(e < 8.5){                  /* 8 SONY CYBER-SHOT — magenta crisp */
    c *= vec3(1.05, 0.95, 1.04);
    c = scurve(c, 0.42);
    c = sat(c, 1.16);
    c = splitTone(c, vec3(0.95,0.96,1.05), vec3(1.0));
    grain = 0.24; vig = 0.28;
  }
  else if(e < 9.5){                  /* 9 NIKON COOLPIX — netral hangat soft */
    c *= vec3(1.04, 0.99, 0.93);
    c = scurve(c, 0.2);
    c = sat(c, 1.02);
    c = c*0.97 + 0.035;
    grain = 0.26; vig = 0.24;
  }
  else if(e < 10.5){                 /* 10 KODAK EASYSHARE — CCD biru awal 2000 */
    c *= vec3(0.9, 0.97, 1.1);
    c = sat(c, 1.12);
    c = c*0.93 + 0.06;
    c = scurve(c, 0.28);
    grain = 0.5; vig = 0.3;
  }
  else if(e < 11.5){                 /* 11 FUJI FINEPIX — biru-hijau vivid */
    c *= vec3(0.93, 1.05, 1.02);
    c = sat(c, 1.22);
    c = scurve(c, 0.35);
    c = c*0.96 + 0.03;
    grain = 0.3; vig = 0.3;
  }
  else if(e < 12.5){                 /* 12 OLYMPUS MJU — flash keras klasik */
    c *= vec3(1.09, 0.98, 0.9);
    c *= 1.08;                        /* wajah kepala up */
    c = scurve(c, 0.45);
    c = sat(c, 1.05);
    grain = 0.35; vig = 0.55;         /* latar jatuh gelap */
    haloAmt = 0.18; haloTint = vec3(1.0,0.9,0.75);
  }
  else if(e < 13.5){                 /* 13 Y2K FLASH — hard flash modern */
    c *= vec3(1.0, 1.0, 1.03);
    c *= 1.12;
    c = scurve(c, 0.5);
    c = sat(c, 0.98);
    grain = 0.3; vig = 0.68;          /* vignette paling kuat */
    haloAmt = 0.22; haloTint = vec3(0.9,0.95,1.0);
  }
  else {                             /* 14 POLAROID 600 — cream fade */
    c = c*0.9 + 0.09;
    c *= vec3(1.07, 1.03, 0.9);
    c = sat(c, 0.85);
    c = scurve(c, -0.15 + 0.15);     /* netral, fade dari lift */
    grain = 0.32; vig = 0.22;
  }

  /* halation / bloom dari area terang */
  if(haloAmt > 0.001){
    vec2 px = 4.0 / u_res;
    vec3 glow = ( brightPass(uv + vec2(px.x,0.0)) + brightPass(uv - vec2(px.x,0.0))
                + brightPass(uv + vec2(0.0,px.y)) + brightPass(uv - vec2(0.0,px.y)) ) * 0.25;
    c += glow * haloAmt * haloTint;
  }

  /* vignette */
  float d = distance(uv, vec2(0.5));
  c *= 1.0 - vig * smoothstep(0.32, 0.75, d);

  /* film grain — halus di tengah, kasar di shadow */
  float g = hash(uv * u_res * 0.75 + fract(u_time) * 13.7) - 0.5;
  float shad = 1.0 - luma(c);
  c += g * grain * mix(0.05, 0.16, shad);

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    throw new Error('shader compile failed');
  }
  return s;
}

/** Buat renderer untuk 1 canvas. Panggil render(videoOrImage, effectId, mirror). */
export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
  if (!gl) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const U = {};
  for (const n of ['u_tex','u_effect','u_time','u_res','u_mirror']) U[n] = gl.getUniformLocation(prog, n);
  gl.uniform1i(U.u_tex, 0);

  let t0 = performance.now();
  function render(source, effectId, mirror) {
    const w = source.videoWidth || source.naturalWidth || source.width;
    const h = source.videoHeight || source.naturalHeight || source.height;
    if (!w || !h) return false;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source); }
    catch (err) { return false; }
    gl.uniform1f(U.u_effect, effectId);
    gl.uniform1f(U.u_time, (performance.now() - t0) / 1000);
    gl.uniform2f(U.u_res, w, h);
    gl.uniform1f(U.u_mirror, mirror ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }
  return { render, canvas };
}

/** Render efek sekali ke sumber gambar/video apa pun → canvas hasil. */
export async function renderOnce(source, effectId, mirror) {
  const c = document.createElement('canvas');
  const r = createRenderer(c);
  if (!r) {
    // fallback tanpa WebGL: copy mentah
    c.width = source.videoWidth || source.naturalWidth;
    c.height = source.videoHeight || source.naturalHeight;
    const ctx = c.getContext('2d');
    if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(source, 0, 0);
    return c;
  }
  r.render(source, effectId, mirror);
  return c;
}

/** Overlay ala kamera: date-stamp oranye + nomor frame. Mutasi ctx 2D. */
export function stampOverlay(canvas2d, { date = new Date(), frame = null, effectId = 1 } = {}) {
  const ctx = canvas2d.getContext('2d');
  const W = canvas2d.width, H = canvas2d.height;
  const s = Math.max(18, Math.round(H * 0.032));
  const pad = Math.round(s * 0.7);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(2);
  ctx.save();
  ctx.font = `700 ${s}px "Courier New", monospace`;
  ctx.shadowColor = 'rgba(255,140,46,.75)';
  ctx.shadowBlur = s * 0.35;
  ctx.fillStyle = '#FF8C2E';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'right';
  if (effectId !== 0) {
    ctx.fillText(`${yy} ${mm} ${dd}`, W - pad, H - pad);
  }
  if (frame) {
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(200,30,30,.7)';
    ctx.fillStyle = '#D0362C';
    ctx.fillText(String(frame), pad, H - pad);
  }
  ctx.restore();
}
