// --- Registro Service Worker PWA ---
let deferredPrompt;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registrado:', reg.scope))
      .catch(err => console.error('Error SW:', err));
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) installBtn.style.display = 'inline-flex';
});

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      document.getElementById('installAppBtn').style.display = 'none';
    });
  }
}

// --- Lógica del Calculador ---
let leftYValues = [];

function computeLeftPoints(totalWidth) {
  const xCenter = totalWidth / 2.0;
  let pts = [];
  let currX = 0;
  let ptIdx = 0;
  const EPS = 0.0001;

  if (xCenter <= 0) return pts;

  const initialStepCm = parseFloat(document.getElementById('select-initial-step-cm').value) || 15;
  const initialStepM = initialStepCm / 100.0;
  const initialCount = parseInt(document.getElementById('input-initial-count').value) || 0;

  const mainStepM = parseFloat(document.getElementById('select-main-step-m').value) || 1.00;
  const mainCount = parseInt(document.getElementById('input-main-count').value) || 0;

  pts.push({ idx: 0, x: 0, dx: 0, label: "Inicio (X=0)" });

  // 1. Tramo Inicial (cm)
  for (let i = 0; i < initialCount; i++) {
    if (currX + initialStepM >= xCenter - EPS) {
      let dxAdj = xCenter - currX;
      currX = xCenter;
      ptIdx++;
      pts.push({ idx: ptIdx, x: Math.round(currX * 100) / 100, dx: Math.round(dxAdj * 100) / 100, isCenter: true });
      break;
    }
    currX += initialStepM;
    ptIdx++;
    pts.push({ idx: ptIdx, x: Math.round(currX * 100) / 100, dx: initialStepM });
  }

  // 2. Tramo Secundario (m)
  if (currX < xCenter - EPS) {
    for (let i = 0; i < mainCount; i++) {
      if (currX + mainStepM >= xCenter - EPS) {
        let dxAdj = xCenter - currX;
        currX = xCenter;
        ptIdx++;
        pts.push({ idx: ptIdx, x: Math.round(currX * 100) / 100, dx: Math.round(dxAdj * 100) / 100, isCenter: true });
        break;
      }
      currX += mainStepM;
      ptIdx++;
      pts.push({ idx: ptIdx, x: Math.round(currX * 100) / 100, dx: mainStepM });
    }
  }

  // 3. Remanente al Centro
  if (currX < xCenter - EPS) {
    let dxRemanente = xCenter - currX;
    currX = xCenter;
    ptIdx++;
    pts.push({ idx: ptIdx, x: Math.round(currX * 100) / 100, dx: Math.round(dxRemanente * 100) / 100, isCenter: true });
  } else {
    if (pts.length > 0) pts[pts.length - 1].isCenter = true;
  }

  return pts;
}

function getLeftCalculatedPoints() {
  const totalWidth = parseFloat(document.getElementById('input-total-width').value) || 0;
  const centerHeight = parseFloat(document.getElementById('input-center-height').value) || 0;

  const leftPts = computeLeftPoints(totalWidth);
  if (leftPts.length === 0) return [];

  const centerIndex = leftPts.length - 1;

  let pts = [];
  for (let i = 0; i <= centerIndex; i++) {
    let p = leftPts[i];
    let yVal = (i === centerIndex) ? centerHeight : ((leftYValues[i] !== undefined) ? leftYValues[i] : 0);
    pts.push({ x: p.x, y: yVal, dx: p.dx, isCenter: (i === centerIndex), isMirror: false });
  }
  return pts;
}

function getFullCalculatedPoints() {
  const leftPts = getLeftCalculatedPoints();
  if (leftPts.length === 0) return [];

  const centerIndex = leftPts.length - 1;

  let fullPts = [...leftPts];
  let stepsX = leftPts.map(p => p.dx);

  let currentX = fullPts[centerIndex].x;
  for (let i = centerIndex - 1; i >= 0; i--) {
    let stepDist = stepsX[i + 1];
    currentX += stepDist;
    let mirrorY = fullPts[i].y;
    fullPts.push({ x: Math.round(currentX * 100) / 100, y: mirrorY, dx: stepDist, isCenter: false, isMirror: true });
  }

  return fullPts;
}

function calculateArcLength(points) {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    let dx = points[i+1].x - points[i].x;
    let dy = points[i+1].y - points[i].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

function updateMetrics() {
  const fullPoints = getFullCalculatedPoints();
  const totalWidth = parseFloat(document.getElementById('input-total-width').value) || 0;
  const centerHeight = parseFloat(document.getElementById('input-center-height').value) || 0;
  const arcLength = calculateArcLength(fullPoints);

  document.getElementById('metric-width').textContent = `${totalWidth.toFixed(2)} m`;
  document.getElementById('metric-height').textContent = `${centerHeight.toFixed(2)} m`;
  document.getElementById('metric-arc-length').textContent = `${arcLength.toFixed(2)} m`;
}

function autoInterpolateMissing() {
  const totalWidth = parseFloat(document.getElementById('input-total-width').value) || 0;
  const leftPts = computeLeftPoints(totalWidth);
  if (leftPts.length === 0) return;

  const centerIndex = leftPts.length - 1;

  let knownIndices = [];
  for (let i = 0; i <= centerIndex; i++) {
    if (leftYValues[i] !== undefined && leftYValues[i] > 0) {
      knownIndices.push(i);
    }
  }

  if (leftYValues[0] === undefined) leftYValues[0] = 0;
  if (!knownIndices.includes(0)) knownIndices.unshift(0);
  if (!knownIndices.includes(centerIndex)) knownIndices.push(centerIndex);

  for (let k = 0; k < knownIndices.length - 1; k++) {
    let iStart = knownIndices[k];
    let iEnd = knownIndices[k + 1];
    let yStart = leftYValues[iStart];
    let yEnd = leftYValues[iEnd];
    let count = iEnd - iStart;

    for (let j = iStart + 1; j < iEnd; j++) {
      let ratio = (j - iStart) / count;
      leftYValues[j] = Math.round((yStart + (yEnd - yStart) * ratio) * 100) / 100;
    }
  }

  recalculateStructure();
}

function recalculateStructure() {
  const totalWidth = parseFloat(document.getElementById('input-total-width').value) || 0;
  const leftPts = computeLeftPoints(totalWidth);

  if (leftPts.length > 0) {
    const centerIndex = leftPts.length - 1;
    for (let i = 0; i <= centerIndex; i++) {
      if (leftYValues[i] === undefined) {
        leftYValues[i] = 0;
      }
    }
  }

  renderInputs();
  drawAllGraphs();
}

function renderInputs() {
  const totalWidth = parseFloat(document.getElementById('input-total-width').value) || 0;
  const centerHeight = parseFloat(document.getElementById('input-center-height').value) || 0;
  
  const container = document.getElementById('points-list');
  container.innerHTML = '';

  if (totalWidth <= 0) {
    container.innerHTML = '<div style="padding: 12px; color: #64748b; text-align: center; font-size: 0.85rem;">Mide e ingresa el <b>Ancho Total</b> en la sección 1 para desplegar las casillas de medición.</div>';
    return;
  }

  const leftPts = computeLeftPoints(totalWidth);
  const centerIndex = leftPts.length - 1;

  for (let i = 0; i <= centerIndex; i++) {
    const isFirst = (i === 0);
    const isCenter = (i === centerIndex);
    const p = leftPts[i];

    let currentY = isCenter ? centerHeight : (leftYValues[i] !== undefined ? leftYValues[i] : 0);

    const row = document.createElement('div');
    row.className = `point-row ${isCenter ? 'center-point' : ''}`;
    
    let badgeHTML = '';
    if (isFirst) badgeHTML = `<div class="badge badge-center">🏁 Inicio (X=0.00m)</div>`;
    else if (isCenter) badgeHTML = `<div class="badge badge-center">📌 Centro (X=${p.x.toFixed(2)}m, Y=${centerHeight.toFixed(2)}m)</div>`;

    row.innerHTML = `
      ${badgeHTML}
      <div>
        <label>X (${i}) [m]</label>
        <input type="number" value="${p.x.toFixed(2)}" disabled style="background-color: #e2e8f0;">
      </div>
      <div>
        <label>Y (${i}) [m]</label>
        <input type="number" step="0.01" value="${currentY}" ${isCenter ? 'disabled style="background-color: #fef08a;"' : ''} oninput="updatePointY(${i}, this.value)">
      </div>
    `;
    container.appendChild(row);
  }
}

function updatePointY(index, value) {
  leftYValues[index] = parseFloat(value) || 0;
  drawAllGraphs();
}

function clearData() {
  document.getElementById('input-graph-title').value = "";
  document.getElementById('input-total-width').value = "";
  document.getElementById('input-center-height').value = "";
  document.getElementById('select-initial-step-cm').value = "15";
  document.getElementById('input-initial-count').value = "5";
  document.getElementById('select-main-step-m').value = "1.00";
  document.getElementById('input-main-count').value = "1";
  leftYValues = [];
  recalculateStructure();
}

function saveRecord() {
  const title = document.getElementById('input-graph-title').value || "Sin Nombre";
  const width = document.getElementById('input-total-width').value || "0";
  const height = document.getElementById('input-center-height').value || "0";
  
  const record = {
    id: Date.now(),
    title,
    width,
    height,
    initialStepCm: document.getElementById('select-initial-step-cm').value,
    initialCount: document.getElementById('input-initial-count').value,
    mainStepM: document.getElementById('select-main-step-m').value,
    mainCount: document.getElementById('input-main-count').value,
    leftYValues,
    date: new Date().toLocaleDateString()
  };

  let history = JSON.parse(localStorage.getItem('curva_history') || '[]');
  history.unshift(record);
  localStorage.setItem('curva_history', JSON.stringify(history));
  renderHistory();
  alert('¡Registro guardado correctamente!');
}

function renderHistory() {
  let history = JSON.parse(localStorage.getItem('curva_history') || '[]');
  const container = document.getElementById('historial-items');
  if (history.length === 0) {
    container.innerHTML = '<span style="font-size: 0.75rem; color: #64748b;">No hay registros</span>';
    return;
  }
  container.innerHTML = history.map(item => `
    <div class="historial-item">
      <span>${item.title} (${item.date})</span>
      <button style="font-size: 0.7rem; padding: 2px 6px; cursor: pointer;" onclick="loadRecord(${item.id})">Cargar</button>
    </div>
  `).join('');
}

function loadRecord(id) {
  let history = JSON.parse(localStorage.getItem('curva_history') || '[]');
  let item = history.find(i => i.id === id);
  if (item) {
    document.getElementById('input-graph-title').value = item.title;
    document.getElementById('input-total-width').value = item.width;
    document.getElementById('input-center-height').value = item.height;
    if (item.initialStepCm) document.getElementById('select-initial-step-cm').value = item.initialStepCm;
    if (item.initialCount) document.getElementById('input-initial-count').value = item.initialCount;
    if (item.mainStepM) document.getElementById('select-main-step-m').value = item.mainStepM;
    if (item.mainCount) document.getElementById('input-main-count').value = item.mainCount;
    leftYValues = item.leftYValues;
    recalculateStructure();
  }
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const title = document.getElementById('input-graph-title').value || "Estructura Curva";
  const halfPoints = getLeftCalculatedPoints();
  const fullPoints = getFullCalculatedPoints();
  const arcLength = calculateArcLength(fullPoints);

  const now = new Date();
  const dateTimeStr = now.toLocaleString();

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(title, 14, 15);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(`Generado el: ${dateTimeStr} | By MonRoyLab`, 14, 20);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`Desarrollo de la linea curva o arco: ${arcLength.toFixed(2)} m`, 14, 27);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(`Ancho Total: ${document.getElementById('input-total-width').value || '0'} m  |  Altura Centro: ${document.getElementById('input-center-height').value || '0'} m`, 14, 32);

  const canvasFull = document.getElementById('cartesianCanvasFull');
  const canvasHalf = document.getElementById('cartesianCanvasHalf');

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("1. Vista Completa (Simétrica)", 14, 39);
  doc.addImage(canvasFull.toDataURL('image/png'), 'PNG', 14, 41, 182, 70);

  doc.text("2. Vista Parcial (Hasta el Punto Medio)", 14, 115);
  doc.addImage(canvasHalf.toDataURL('image/png'), 'PNG', 14, 117, 182, 70);

  const headers = ['Punto', ...halfPoints.map((p, idx) => idx === 0 ? "0" : (p.isCenter ? `${idx} (C)` : `${idx}`))];
  const rowX = ['X (m)', ...halfPoints.map(p => p.x.toFixed(2))];
  const rowY = ['Y (m)', ...halfPoints.map(p => p.y.toFixed(2))];
  const rowDX = ['ΔX (m)', ...halfPoints.map(p => p.dx.toFixed(2))];

  doc.autoTable({
    startY: 191,
    head: [headers],
    body: [rowX, rowY, rowDX],
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: 0.8,
      halign: 'center',
      valign: 'middle',
      textColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 14, halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`Página ${i} de ${pageCount} Step by Step Curve | By MonRoyLab`, 14, 287);
  }

  doc.save(`${title.replace(/\s+/g, '_')}_Reporte.pdf`);
}

// ALGORITMO SPLINE PROTEGIDO CONTRA PAREDES VERTICALES (dx <= 0.0001)
function getMonotoneSplinePath(pts) {
  const n = pts.length;
  if (n < 2) return [];

  let dxs = [], dys = [], ms = [];
  const EPS = 0.00001;

  for (let i = 0; i < n - 1; i++) {
    let dx = pts[i+1].x - pts[i].x;
    let dy = pts[i+1].y - pts[i].y;
    dxs.push(dx);
    dys.push(dy);
    ms.push(Math.abs(dx) < EPS ? 0 : dy / dx);
  }

  let c1s = [ms[0]];
  for (let i = 0; i < ms.length - 1; i++) {
    let m = ms[i], mNext = ms[i+1];
    if (m * mNext <= 0) {
      c1s.push(0);
    } else {
      let dx_ = dxs[i], dxNext = dxs[i+1];
      let common = dx_ + dxNext;
      let denom = (2 * dxNext + dx_) / m + (dx_ + 2 * dxNext) / mNext;
      c1s.push(Math.abs(denom) < EPS ? 0 : (3 * common / denom));
    }
  }
  c1s.push(ms[ms.length - 1]);

  let path = [];
  for (let i = 0; i < n - 1; i++) {
    let p1 = pts[i], p2 = pts[i+1];
    let dx = dxs[i];

    if (Math.abs(dx) < EPS) {
      path.push({ x: p1.x, y: p1.y });
      path.push({ x: p2.x, y: p2.y });
      continue;
    }

    let c1 = c1s[i], c2 = c1s[i+1];
    let steps = 25;
    for (let t = 0; t <= 1; t += 1 / steps) {
      let t2 = t * t, t3 = t2 * t;
      let h00 = 2 * t3 - 3 * t2 + 1;
      let h10 = t3 - 2 * t2 + t;
      let h01 = -2 * t3 + 3 * t2;
      let h11 = t3 - t2;

      let x = p1.x + t * dx;
      let y = h00 * p1.y + h10 * dx * c1 + h01 * p2.y + h11 * dx * c2;
      path.push({ x, y });
    }
  }
  return path;
}

function drawSingleGraph(canvasId, points) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  const availableWidth = rect.width - 30;

  if (points.length < 2) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const paddingLeft = 45;
  const paddingBottom = 45;
  const paddingTop = 25;
  const paddingRight = 25;

  const isSmooth = document.getElementById('smooth-toggle').checked;

  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);

  let minX = 0;
  let maxX = Math.max(...xValues, 0.1);
  let minY = 0;
  let maxY = Math.max(...yValues, 0.1);

  const maxRealY = maxY * 1.20;
  const drawWidth = availableWidth - paddingLeft - paddingRight;
  const pxPerMeter = drawWidth / (maxX - minX);

  const drawHeight = maxRealY * pxPerMeter;
  const totalCanvasHeight = drawHeight + paddingTop + paddingBottom;

  canvas.width = availableWidth;
  canvas.height = totalCanvasHeight;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const toScreenX = (x) => paddingLeft + (x - minX) * pxPerMeter;
  const toScreenY = (y) => canvas.height - paddingBottom - (y - minY) * pxPerMeter;

  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;

  let yStepSize = 0.50;
  if (maxRealY <= 0.8) yStepSize = 0.10;
  else if (maxRealY <= 1.5) yStepSize = 0.25;
  else if (maxRealY <= 4.0) yStepSize = 0.50;
  else yStepSize = 1.00;

  for (let valY = 0; valY <= maxRealY + 0.001; valY += yStepSize) {
    const screenY = toScreenY(valY);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, screenY);
    ctx.lineTo(canvas.width - paddingRight, screenY);
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(valY.toFixed(2) + 'm', paddingLeft - 6, screenY + 3);
  }

  let minDxPixelThreshold = 18;
  let lastDrawnXPixel = -999;

  points.forEach((p, idx) => {
    const screenX = toScreenX(p.x);

    ctx.strokeStyle = p.isCenter ? '#fde68a' : '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(screenX, paddingTop);
    ctx.lineTo(screenX, canvas.height - paddingBottom);
    ctx.stroke();

    const canDrawLabelX = (screenX - lastDrawnXPixel >= minDxPixelThreshold) || p.isCenter || idx === points.length - 1;

    if (canDrawLabelX) {
      lastDrawnXPixel = screenX;
      ctx.save();
      ctx.translate(screenX, canvas.height - paddingBottom + 6);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(p.x.toFixed(2), 0, 3);
      ctx.restore();
    }
  });

  const centerPt = points.find(p => p.isCenter);
  if (centerPt) {
    const cx = toScreenX(centerPt.x);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, paddingTop);
    ctx.lineTo(cx, canvas.height - paddingBottom);
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, canvas.height - paddingBottom);
  ctx.lineTo(canvas.width - paddingRight, canvas.height - paddingBottom);
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, canvas.height - paddingBottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2.2;

  if (!isSmooth) {
    points.forEach((p, idx) => {
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
  } else {
    const smoothPath = getMonotoneSplinePath(points);
    smoothPath.forEach((p, idx) => {
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
  }
  ctx.stroke();

  points.forEach((p, idx) => {
    const sx = toScreenX(p.x);
    const sy = toScreenY(p.y);

    ctx.beginPath();
    ctx.arc(sx, sy, p.isCenter ? 5 : 3.5, 0, Math.PI * 2);
    
    if (p.isCenter) ctx.fillStyle = '#d97706';
    else if (p.isMirror) ctx.fillStyle = '#0284c7';
    else ctx.fillStyle = '#2563eb';

    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.save();
    ctx.translate(sx, sy - 6);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    
    if (points.length <= 15 || idx % 2 === 0 || p.isCenter) {
      ctx.fillText(p.y.toFixed(2), 0, 3);
    }
    ctx.restore();
  });
}

function drawAllGraphs() {
  drawSingleGraph('cartesianCanvasFull', getFullCalculatedPoints());
  drawSingleGraph('cartesianCanvasHalf', getLeftCalculatedPoints());
  updateMetrics();
}

window.addEventListener('resize', drawAllGraphs);
renderInputs();
renderHistory();
drawAllGraphs();