/* ============================================================================
   BLKTEST — ④ 사진 자동판독 자체시험
   ----------------------------------------------------------------------------
   왜 이 방식인가
     크롬 숨은 탭은 얼어붙어 «찍어 놓고 나중에 보기»가 안 된다. 그래서 검증은
     페이지가 열려 있는 그 자리에서 돌려야 한다. 또 실사진은 정답(줄눈이 실제로
     어디인지)을 모르므로, 정답을 아는 사진을 만들어 대조한다.

   합성은 «진짜 카메라 모형»으로 한다
     높이 h·내림각 θ·초점 f35 가 서로 맞물린 핀홀 모형으로 지면을 투영한다.
     그래야 앱이 EXIF 초점으로 «비(比) 복원»하는 경로까지 같이 시험된다.
     (아무 사다리꼴이나 쓰면 EXIF 와 아귀가 안 맞아 앱을 부당하게 떨어뜨린다)

   쓰는 법 — 앱을 띄운 탭의 콘솔에서
     eval(await (await fetch('_test/selftest.js')).text()); await BLKTEST.run()

   판정
     · 모서리 오차 < 0.15장   ← 격자와 어긋나면 옆 줄눈으로 건너뛴다
     · 장수(nc·nr) 가 참값과 일치 ← 이 값이 곧 구획 실치수 = 축척이다
   ========================================================================== */
(function (root) {
  "use strict";

  /* 지면(X: 좌우 mm, Z: 앞뒤 mm) → 사진 좌표. 핀홀 + 내림각. */
  function camera(o) {
    var IW = o.IW, IH = o.IH, f35 = o.f35, hh = o.h, th = o.deg * Math.PI / 180;
    var f = f35 * Math.hypot(IW, IH) / 43.2666, cx = IW / 2, cy = IH / 2;
    var ct = Math.cos(th), st = Math.sin(th);
    var H = [f, cx * ct, cx * hh * st,
             0, cy * ct - f * st, hh * (f * ct + cy * st),
             0, ct, hh * st];
    var Hi = root.BlockAutoCore.inv3(H);
    return {
      f35: f35, H: H,
      fwd: function (X, Z) {
        var w = H[6] * X + H[7] * Z + H[8];
        return [(H[0] * X + H[1] * Z + H[2]) / w, (H[3] * X + H[4] * Z + H[5]) / w];
      },
      back: function (u, v) {                      // 사진 → 지면
        var q = root.BlockAutoCore.mulv3(Hi, [u, v, 1]);
        return [q[0] / q[2], q[1] / q[2]];
      }
    };
  }

  /* 블록을 깔아 사진을 그린다. bond="stack"(일렬) | "run"(엇금) */
  function paint(cam, o) {
    var IW = o.IW, IH = o.IH, bw = o.bw, bh = o.bh, jt = o.jt;
    var c = document.createElement("canvas"); c.width = IW; c.height = IH;
    var x = c.getContext("2d");
    x.fillStyle = "#8e8e90"; x.fillRect(0, 0, IW, IH);        // 포장 밖
    var px = bw + jt, pz = bh + jt;
    var X0 = -(o.nx * px) / 2, Z0 = o.Z0;
    var q = [cam.fwd(X0 - px, Z0), cam.fwd(X0 + (o.nx + 1) * px, Z0),
             cam.fwd(X0 + (o.nx + 1) * px, Z0 + o.nz * pz), cam.fwd(X0 - px, Z0 + o.nz * pz)];
    x.fillStyle = "#3a3a3c";                                   // 줄눈(어두움)
    x.beginPath(); x.moveTo(q[0][0], q[0][1]);
    for (var k = 1; k < 4; k++) x.lineTo(q[k][0], q[k][1]);
    x.closePath(); x.fill();
    var seed = o.seed || 11;
    function rnd() { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; }
    for (var j = 0; j < o.nz; j++) {
      var off = (o.bond === "run" && (j & 1)) ? px / 2 : 0;
      for (var i = -1; i <= o.nx; i++) {
        var X = X0 + i * px + off, Z = Z0 + j * pz;
        var p1 = cam.fwd(X, Z), p2 = cam.fwd(X + bw, Z),
            p3 = cam.fwd(X + bw, Z + bh), p4 = cam.fwd(X, Z + bh);
        var v = 178 + Math.round(rnd() * 24);
        x.fillStyle = "rgb(" + v + "," + (v - 7) + "," + (v - 15) + ")";
        x.beginPath(); x.moveTo(p1[0], p1[1]); x.lineTo(p2[0], p2[1]);
        x.lineTo(p3[0], p3[1]); x.lineTo(p4[0], p4[1]); x.closePath(); x.fill();
      }
    }
    var im = x.getImageData(0, 0, IW, IH), D = im.data;
    for (var t = 0; t < D.length; t += 4) {
      var n = (rnd() - 0.5) * (o.noise == null ? 14 : o.noise);
      D[t] += n; D[t + 1] += n; D[t + 2] += n;
    }
    x.putImageData(im, 0, 0);
    return c.toDataURL("image/jpeg", 0.92);
  }

  function make(o) {
    o = Object.assign({ IW: 1600, IH: 1200, f35: 26, h: 1500, deg: 35,
                        bw: 200, bh: 100, jt: 3, nx: 21, nz: 46, Z0: 600,
                        bond: "stack" }, o || {});
    var cam = camera(o);
    return { o: o, cam: cam, url: paint(cam, o) };
  }

  function load(url) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej; im.src = url;
    });
  }

  /* 지면 좌표를 «가장 가까운 줄눈 교점»까지의 거리(장 단위)로.
     ⚠엇금(벽돌형)은 세로 줄눈이 한 줄 걸러 반 장씩 어긋나 있다. 구획의
     세로 변이 «하나의 줄눈»을 따라갈 수 없는 것은 깔기 방식의 성질이지
     앱의 결함이 아니다 → 두 어긋남 중 가까운 쪽으로 잰다. */
  function latErr(S, X, Z) {
    var px = S.o.bw + S.o.jt, pz = S.o.bh + S.o.jt, X0 = -(S.o.nx * px) / 2, Z0 = S.o.Z0;
    var jf = (Z - Z0) / pz, j = Math.round(jf);
    var dz = (Z - (Z0 + j * pz - S.o.jt / 2)) / pz;
    var offs = S.o.bond === "run" ? [0, px / 2] : [0];
    var best = 1e9;
    for (var k = 0; k < offs.length; k++) {
      var xf = (X - (X0 + offs[k] - S.o.jt / 2)) / px;
      var dx = xf - Math.round(xf);
      best = Math.min(best, Math.hypot(dx, dz));
    }
    return best;
  }

  /* 화소당 mm 시험 —— 탭 0회 판독은 이 값으로 곧장 mm 를 낸다.
     참값은 «펴진 그림에서 실제 한 칸이 몇 화소인가»로 구한다. */
  async function mmCheck(name, opt) {
    var S = make(opt), im = await load(S.url);
    var maxW = Math.min(im.width, 2600);
    var full = root.uCanvasData(im, maxW), work = root.uCanvasData(im, Math.min(1400, maxW));
    var R = root.BlockAuto.analyze(full, work, {
      blockW: S.o.bw, blockH: S.o.bh, joint: S.o.jt,
      f35: opt && opt.noExif ? null : S.o.f35, frac: 0.75
    });
    if (!R.ok) return { name: name, ok: false, why: R.why };
    var Hf = R.rectData.Hf;
    function fwd(X, Z) {
      var p = S.cam.fwd(X, Z), q = root.BlockAutoCore.mulv3(Hf, [p[0], p[1], 1]);
      return [q[0] / q[2], q[1] / q[2]];
    }
    var px = S.o.bw + S.o.jt, pz = S.o.bh + S.o.jt;
    var A = fwd(0, S.o.Z0 + 6 * pz), B = fwd(px, S.o.Z0 + 6 * pz), C2 = fwd(0, S.o.Z0 + 7 * pz);
    var trueX = px / Math.hypot(B[0] - A[0], B[1] - A[1]);       // mm/화소
    var trueZ = pz / Math.hypot(C2[0] - A[0], C2[1] - A[1]);
    var truth = (trueX + trueZ) / 2;
    var err = R.mmpx / truth - 1;
    return { name: name, ok: true, mmpx: +R.mmpx.toFixed(3), truth: +truth.toFixed(3),
             errPct: +(err * 100).toFixed(1), pass: Math.abs(err) < 0.05 };
  }

  /* ── 측면 사진 합성 ──────────────────────────────────────────────
     3m 직선자를 노면에 올려 놓고 옆에서 찍은 사진. 자 밑에 생기는 틈의
     최대값이 곧 평탄성 값이다 —— 그 값을 «알고» 만든다. */
  function sideMake(o) {
    o = Object.assign({ IW: 1600, IH: 1000, L: 3000, T: 50,
                        dip: 14, dipAt: 0.5, dipW: 0.16, ripple: 2.5,
                        tilt: -50, near: 52, far: 38, seed: 5 }, o || {});
    var IW = o.IW, IH = o.IH;
    /* 자 옆면 네 모서리(좌상·우상·우하·좌하)를 화면에 놓는다. 위·아래 모서리가
       조금 모이게 두어 실제 측면 사진의 원근을 흉내낸다. */
    /* edge:true 면 자가 화면 밖으로 나간다 — 길이를 모르니 축척이 없다 */
    var x0 = o.edge ? -IW * 0.06 : IW * 0.09;
    var x1 = o.edge ? IW * 1.06 : IW * 0.91;
    var y0 = IH * 0.50, y1 = y0 + o.tilt;
    var Q = [[x0, y0], [x1, y1], [x1, y1 + o.far], [x0, y0 + o.near]];
    var Hm = root.BlockScan.homography([[0, o.T], [o.L, o.T], [o.L, 0], [0, 0]], Q);
    function P(X, Yup) { return root.BlockScan.applyH(Hm, X, Yup); }
    /* 노면 높이 s(X) ≤ 0 —— 가운데가 파이고 잔물결이 있다 */
    var seed = o.seed;
    function rnd() { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; }
    function surf(X) {
      var t = (X / o.L - o.dipAt) / o.dipW;
      var dip = -o.dip * Math.exp(-t * t);
      var rip = -o.ripple * (0.5 - 0.5 * Math.cos(X / o.L * 11));
      var end = -Math.min(1, Math.pow(Math.min(X, o.L - X) / (o.L * 0.06), 2));
      return dip + rip * (1 + end) * 0 + rip;
    }
    var c = document.createElement("canvas"); c.width = IW; c.height = IH;
    var x = c.getContext("2d");
    x.fillStyle = "#6b7078"; x.fillRect(0, 0, IW, IH);               // 뒤 배경
    /* 자 밑 ~ 노면 사이 = 그늘(어둡다). 노면 아래는 포장. */
    var i, pts = [], N = 240;
    for (i = 0; i <= N; i++) { var X = o.L * i / N; pts.push(P(X, surf(X))); }
    x.fillStyle = "#1b1d20";                                          // 그늘
    x.beginPath(); x.moveTo(Q[3][0], Q[3][1]); x.lineTo(Q[2][0], Q[2][1]);
    for (i = N; i >= 0; i--) x.lineTo(pts[i][0], pts[i][1]);
    x.closePath(); x.fill();
    x.fillStyle = "#9a968f";                                          // 포장 몸통
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i <= N; i++) x.lineTo(pts[i][0], pts[i][1]);
    x.lineTo(IW, IH); x.lineTo(0, IH); x.closePath(); x.fill();
    /* 포장 줄눈(측면에서는 세로로 보인다) */
    x.strokeStyle = "#5f5c58"; x.lineWidth = 2;
    for (var X2 = 0; X2 <= o.L; X2 += 203) {
      var a = P(X2, surf(X2)), b = P(X2, surf(X2) - 120);
      x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
    }
    /* 자 —— 알루미늄, 고르고 밝다 */
    var gd = x.createLinearGradient(0, y0, 0, y0 + o.near);
    gd.addColorStop(0, "#e6e8ea"); gd.addColorStop(1, "#c6c9cc");
    x.fillStyle = gd;
    x.beginPath(); x.moveTo(Q[0][0], Q[0][1]);
    for (i = 1; i < 4; i++) x.lineTo(Q[i][0], Q[i][1]);
    x.closePath(); x.fill();
    var im = x.getImageData(0, 0, IW, IH), D = im.data;
    for (var t2 = 0; t2 < D.length; t2 += 4) {
      var nz = (rnd() - 0.5) * (o.noise == null ? 12 : o.noise);
      D[t2] += nz; D[t2 + 1] += nz; D[t2 + 2] += nz;
    }
    x.putImageData(im, 0, 0);
    /* 참 최대 틈 —— 양단 제외 구간 안에서 */
    var skip = o.skip == null ? 750 : o.skip, mx = 0;
    for (i = 0; i <= 2000; i++) {
      var Xs = o.L * i / 2000;
      if (Xs < skip || Xs > o.L - skip) continue;
      mx = Math.max(mx, -surf(Xs));
    }
    return { o: o, quad: Q, url: c.toDataURL("image/jpeg", 0.93), 참최대틈: mx, skip: skip };
  }

  /* 자를 스스로 찾는가 + 찾은 자로 잰 틈이 맞는가 */
  async function sideCheck(name, opt) {
    var S = sideMake(opt), im = await load(S.url);
    var F = root.findRuler(im);
    if (!F.ok) return { name: name, ok: false, why: F.why, pass: !!(opt && opt.expectFail) };
    var e = F.quad.map(function (q, i) {
      return Math.hypot(q.x - S.quad[i][0], q.y - S.quad[i][1]);
    });
    var maxE = Math.max.apply(null, e);
    /* 찾은 자로 실제 판독까지 돌린다 */
    root.AM.img = im; root.AM.reset(); root.AM.fit();
    root.AM.pts.quad = F.quad.map(function (q) { return { x: q.x, y: q.y }; });
    root.aMode = "side"; root.aKind = "flat";
    document.querySelector("#aRl").value = S.o.L;
    document.querySelector("#aRt").value = S.o.T;
    document.querySelector("#aGtol").value = 10;
    document.querySelector("#aSkip").value = S.skip;
    var got = null, why = "";
    try { root.aReadSide(); got = root.aRes && root.aRes.r ? root.aRes.r.max : null; }
    catch (err) { why = err.message; }
    var err2 = got == null ? null : got - S.참최대틈;
    return { name: name, ok: true,
             모서리오차px: +maxE.toFixed(1),
             참최대틈mm: +S.참최대틈.toFixed(1),
             잰최대틈mm: got == null ? null : +got.toFixed(1),
             오차mm: err2 == null ? null : +err2.toFixed(1), why: why,
             pass: maxE < 12 && err2 != null && Math.abs(err2) <= 2.0 };
  }

  var SIDE = [
    ["기준 · 가운데 14mm 파임", {}],
    ["얕은 파임 6mm", { dip: 6, ripple: 1.5 }],
    ["깊은 파임 22mm", { dip: 22 }],
    ["자를 비스듬히 봄", { tilt: -95, near: 58, far: 30 }],
    ["잔물결만(파임 없음)", { dip: 0, ripple: 3 }],
    ["자가 화면 밖으로", { edge: true, expectFail: true }]
  ];

  async function runSide() {
    var out = [];
    for (var i = 0; i < SIDE.length; i++) {
      out.push(await sideCheck(SIDE[i][0], SIDE[i][1]));
      console.log("[BLKTEST/side]", JSON.stringify(out[out.length - 1]));
    }
    return out;
  }

  /* ★가장 중요한 안전 성질 —— 평면 사진을 측면으로, 측면 사진을 평면으로
     가리면 엉뚱한 값을 낸다. 둘을 섞어 놓고 다 맞히는지 본다. */
  async function classifyCheck() {
    var out = [], i;
    for (i = 0; i < 4; i++) {
      var S = make(CASES[i][1]), im = await load(S.url);
      document.querySelector("#aBw").value = S.o.bw;
      document.querySelector("#aBh").value = S.o.bh;
      root.uF35 = S.o.f35;
      var k = root.classifyPhoto(im);
      out.push({ 사진: "평면 · " + CASES[i][0], 가림: k.kind,
                 pass: k.kind === "plan", why: k.why || "" });
    }
    for (i = 0; i < SIDE.length; i++) {
      var S2 = sideMake(SIDE[i][1]), im2 = await load(S2.url);
      var k2 = root.classifyPhoto(im2);
      var want = SIDE[i][1].expectFail ? "?" : "side";
      out.push({ 사진: "측면 · " + SIDE[i][0], 가림: k2.kind,
                 pass: k2.kind === want || (want === "?" && k2.kind !== "side"),
                 why: (k2.why || "").slice(0, 50) });
    }
    return out;
  }

  async function one(name, opt) {
    var S = make(opt);
    var im = await load(S.url);
    root.AM.img = im; if (root.AM.fit) root.AM.fit();
    document.querySelector("#aBw").value = S.o.bw;
    document.querySelector("#aBh").value = S.o.bh;
    root.uF35 = opt && opt.noExif ? null : S.o.f35;
    var t0 = performance.now(), R;
    try { R = root.aFindQuad(im); }
    catch (e) { return { name: name, pass: false, note: "오류 " + e.message }; }
    var ms = Math.round(performance.now() - t0);
    if (!R.ok) return { name: name, pass: !!(opt && opt.expectFail), ok: false, why: R.why, ms: ms };

    var w = R.quad.map(function (p) { return S.cam.back(p.x, p.y); });
    var errs = w.map(function (p) { return latErr(S, p[0], p[1]); });
    var px = S.o.bw + S.o.jt, pz = S.o.bh + S.o.jt;
    var ncT = Math.round(Math.abs(w[1][0] - w[0][0]) / px + Math.abs(w[1][1] - w[0][1]) / pz);
    var nrT = Math.round(Math.abs(w[3][0] - w[0][0]) / px + Math.abs(w[3][1] - w[0][1]) / pz);
    var maxE = Math.max.apply(null, errs);
    /* ★안전 조건 —— «믿는다고 말한 장수»는 반드시 맞아야 한다.
       못 믿겠다고 말했으면(장수를 안 채움) 틀려도 사람이 세게 되어 있다. */
    var countOK = (R.nc === ncT && R.nr === nrT);
    var pass = maxE < 0.15 && (R.trusted ? countOK : true) && !(opt && opt.expectFail);
    return { name: name, pass: pass, ok: true, ms: ms, trusted: !!R.trusted,
             cornerErrBlocks: +maxE.toFixed(3), countOK: countOK,
             nc: R.nc, ncTrue: ncT, nr: R.nr, nrTrue: nrT,
             mmpx: +R.mmpx.toFixed(2), mode: R.mode, snapN: R.snapPts.length };
  }

  var CASES = [
    ["기준 200x100 일렬 35도", {}],
    ["엇금(벽돌형)", { bond: "run" }],
    ["정사각 300x300", { bw: 300, bh: 300, nx: 14, nz: 30, Z0: 400 }],
    ["작은 블록 100x100", { bw: 100, bh: 100, nx: 40, nz: 60 }],
    /* ⚠포장이 화면 아래까지 이어지게 Z0 를 당겨야 한다. 안 그러면 화면 앞쪽이
       «포장 밖 회색»인데 앱이 그것도 포장으로 보아 격자를 그리로 늘린다 —
       합성 쪽 결함이지 앱의 결함이 아니다(0.47장 어긋남으로 나타났었다). */
    ["급한 내림각 50도", { deg: 50, Z0: 250, nz: 60 }],
    ["완만 25도(멀리 보임)", { deg: 25 }],
    ["낮게 들고 찍음 h=900", { h: 900 }],
    ["잡음 큼", { noise: 34 }],
    ["EXIF 초점 없음", { noExif: true }]
  ];

  async function run() {
    var out = [];
    for (var i = 0; i < CASES.length; i++) {
      out.push(await one(CASES[i][0], CASES[i][1]));
      console.log("[BLKTEST]", JSON.stringify(out[out.length - 1]));
    }
    var pass = out.filter(function (r) { return r.pass; }).length;
    console.log("[BLKTEST] 통과 " + pass + "/" + out.length);
    return { pass: pass, n: out.length, rows: out };
  }

  /* 끌어서 고치기 시험 —— 손가락 사건을 그대로 흉내 낸다.
     ① 점을 잡아 끌면 화면이 밀리지 않고 «점»이 따라오는가
     ② 손을 떼면 가까운 줄눈 교점에 달라붙는가
     ③ 끄는 동안 확대창이 뜨는가 */
  async function drag(opt) {
    var S = make(opt), im = await load(S.url);
    root.AM.img = im; root.AM.fit();
    document.querySelector("#aBw").value = S.o.bw;
    document.querySelector("#aBh").value = S.o.bh;
    root.uF35 = S.o.f35;
    var R = root.aFindQuad(im);
    if (!R.ok) return { ok: false, why: R.why };
    root.AM.pts.quad = R.quad.map(function (p) { return { x: p.x, y: p.y }; });
    root.AM.snapPts = R.snapPts;
    root.AM.fit();
    var cv = root.AM.cv, box = cv.getBoundingClientRect();
    var before = { x: root.AM.pts.quad[0].x, y: root.AM.pts.quad[0].y };
    var ox = root.AM.ox, oy = root.AM.oy;
    var A = root.AM.toCv(before);
    function ev(type, cx, cy) {
      cv.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true,
        clientX: box.left + cx, clientY: box.top + cy }));
    }
    ev("pointerdown", A.x + 4, A.y + 4);
    var grabbed = !!root.AM.drag;
    var loupeSeen = false;
    ev("pointermove", A.x + 22, A.y + 14);
    loupeSeen = !!root.AM.drag;                 // 끄는 동안 확대창이 그려진다
    var mid = { x: root.AM.pts.quad[0].x, y: root.AM.pts.quad[0].y };
    ev("pointerup", A.x + 22, A.y + 14);
    var after = { x: root.AM.pts.quad[0].x, y: root.AM.pts.quad[0].y };
    var moved = Math.hypot(mid.x - before.x, mid.y - before.y);
    var panned = Math.hypot(root.AM.ox - ox, root.AM.oy - oy);
    var snapD = 1e9;
    R.snapPts.forEach(function (q) {
      snapD = Math.min(snapD, Math.hypot(q.x - after.x, q.y - after.y));
    });
    return { ok: true, 잡았나: grabbed, 확대창: loupeSeen,
             점이동px: +moved.toFixed(1), 화면밀림px: +panned.toFixed(1),
             달라붙은거리px: +snapD.toFixed(2),
             pass: grabbed && loupeSeen && moved > 3 && panned < 0.01 && snapD < 1 };
  }

  async function runMM() {
    var out = [];
    for (var i = 0; i < CASES.length; i++) {
      out.push(await mmCheck(CASES[i][0], CASES[i][1]));
      console.log("[BLKTEST/mm]", JSON.stringify(out[out.length - 1]));
    }
    return out;
  }

  root.BLKTEST = { run: run, runMM: runMM, one: one, mmCheck: mmCheck, drag: drag,
                   make: make, load: load, CASES: CASES,
                   sideMake: sideMake, sideCheck: sideCheck, runSide: runSide, SIDE: SIDE,
                   classifyCheck: classifyCheck };
})(typeof window !== "undefined" ? window : globalThis);
