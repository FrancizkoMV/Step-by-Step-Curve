// --- EXPORTAR PDF EN ALTA RESOLUCIÓN (HD) ---
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
  doc.addImage(canvasFull.toDataURL('image/png', 1.0), 'PNG', 14, 41, 182, 70);

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

// --- DIBUJO EN CANVAS CON MULTIPLICADOR HD (DPI ESCALADO) ---
function drawSingleGraph(canvasId, points) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  const availableWidth = rect.width - 30;

  if (points.length < 2) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Factor de escalado HD (Rendimiento Retina / Nítido en móviles)
  const scale = 2; 

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

  // Ajuste interno de alta resolución
  canvas.width = availableWidth * scale;
  canvas.height = totalCanvasHeight * scale;
  canvas.style.width = `${availableWidth}px`;
  canvas.style.height = `${totalCanvasHeight}px`;

  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, availableWidth, totalCanvasHeight);

  const toScreenX = (x) => paddingLeft + (x - minX) * pxPerMeter;
  const toScreenY = (y) => totalCanvasHeight - paddingBottom - (y - minY) * pxPerMeter;

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
    ctx.lineTo(availableWidth - paddingRight, screenY);
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(valY.toFixed(2) + 'm', paddingLeft - 6, screenY + 3);
  }

  let minDxPixelThreshold = 22; // Umbral de separación de texto en X
  let lastDrawnXPixel = -999;

  points.forEach((p, idx) => {
    const screenX = toScreenX(p.x);

    ctx.strokeStyle = p.isCenter ? '#fde68a' : '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(screenX, paddingTop);
    ctx.lineTo(screenX, totalCanvasHeight - paddingBottom);
    ctx.stroke();

    const canDrawLabelX = (screenX - lastDrawnXPixel >= minDxPixelThreshold) || p.isCenter || idx === points.length - 1;

    if (canDrawLabelX) {
      lastDrawnXPixel = screenX;
      ctx.save();
      ctx.translate(screenX, totalCanvasHeight - paddingBottom + 6);
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
    ctx.lineTo(cx, totalCanvasHeight - paddingBottom);
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, totalCanvasHeight - paddingBottom);
  ctx.lineTo(availableWidth - paddingRight, totalCanvasHeight - paddingBottom);
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, totalCanvasHeight - paddingBottom);
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

  // Control para evitar la colisión de números en Y cuando están muy juntos
  let lastDrawnYPixel = -999;
  let minDyPixelThreshold = 18;

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

    const canDrawLabelY = (sx - lastDrawnYPixel >= minDyPixelThreshold) || p.isCenter || idx === points.length - 1;

    if (canDrawLabelY) {
      lastDrawnYPixel = sx;
      ctx.save();
      ctx.translate(sx, sy - 6);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.y.toFixed(2), 0, 3);
      ctx.restore();
    }
  });
}