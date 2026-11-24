/**
 * ============================================================================
 * MÓDULO PRINCIPAL DE GESTIÓN Y MAPEO DE DEPÓSITO (APP.JS)
 * ============================================================================
 */

const MAX_CAPACITY = 20;

const PASILLO_CONFIG_OVERRIDES = {
  'PJ': { start: 1 },
  'PZ': { start: 1 },
  'SF': { start: 11, end: 30 },
  'SE': { start: 11, end: 30 },
  'SC': { start: 3, end: 22 },
  'SD': { start: 3, end: 22 }
};

let activeTab = 'PENETRABLE';
let rawInventoryData = [];
let rackTotals = {}; 
let selectivoTotals = {};
let bloqueTotals = {};
let stagingTotals = {};         
let activePasillosPenetrable = [];
let activePasillosSelectivo = [];
let activeBloques = [];
let activeStagingDocks = [];    
let pasilloColumnsMap = {}; 
let pasilloSelectivoColumnsMap = {}; 
let pasilloSelectivoMaxLevelMap = {}; 

let allRubros = new Set();
let allCalidades = new Set();

let rubrosPenetrable = new Set();
let rubrosSelectivo = new Set();
let rubrosBloque = new Set();
let rubrosStaging = new Set();    
let selectedRubroFilter = null;
let currentOpenRackKey = null;

let globalTotalVolumenM3 = 0;

let currentZoneModalKey = null;
let currentZoneTabFilter = 'all';
let currentModalSortCriterion = 'sku_asc';

let printConfigPenetrable = 'zebra_10x17';
let printConfigSelectivo = 'zebra_10x17';
let printConfigCalidad = 'zebra_10x17';

window.stagingOrderMode = window.stagingOrderMode || 'OUT_TOP';

function toggleStagingOrder() {
  window.stagingOrderMode = window.stagingOrderMode === 'IN_TOP' ? 'OUT_TOP' : 'IN_TOP';
  renderMap();
}

let inventorySortField = 'ubicacion';
let inventorySortAsc = true;
let qualitySortField = 'ubicacion';
let qualitySortAsc = true;

function showFormatModal() {
  document.getElementById('formatModalOverlay').classList.remove('hidden');
}

function closeFormatModal() {
  document.getElementById('formatModalOverlay').classList.add('hidden');
}

function escapeHtmlAttr(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getRubroColorHex(rubro) {
  const r = (rubro || '').toString().toUpperCase().trim();
  
  if (r.includes('REPUESTO')) return { bg: '#2563eb', text: '#ffffff', softBg: '#eff6ff', border: '#bfdbfe' };               
  if (r.includes('INFORMATICA') || r.includes('INFORMÁTICA')) return { bg: '#475569', text: '#ffffff', softBg: '#f8fafc', border: '#cbd5e1' }; 
  if (r.includes('LINEA BLANCA') || r.includes('LÍNEA BLANCA')) return { bg: '#059669', text: '#ffffff', softBg: '#ecfdf5', border: '#a7f3d0' }; 
  if (r.includes('TELEVISION') || r.includes('TELEVISIÓN') || r.includes('TV')) return { bg: '#d97706', text: '#ffffff', softBg: '#fffbeb', border: '#fde68a' }; 
  if (r.includes('PEQUEÑO') || r.includes('ELECTRO')) return { bg: '#db2777', text: '#ffffff', softBg: '#fdf2f8', border: '#fbcfe8' }; 
  
  if (r.includes('CENTRAL')) return { bg: '#0284c7', text: '#ffffff', softBg: '#f0f9ff', border: '#bae6fd' }; 
  if (r.includes('INDIVIDUAL') || r.includes('SPLIT')) return { bg: '#0891b2', text: '#ffffff', softBg: '#ecfeff', border: '#a5f3fc' }; 
  if (r.includes('AIRE') || r.includes('CLIMA')) return { bg: '#0284c7', text: '#ffffff', softBg: '#f0f9ff', border: '#bae6fd' };    

  if (r.includes('COCC') || r.includes('COCCIÓN')) return { bg: '#7c3aed', text: '#ffffff', softBg: '#f5f3ff', border: '#ddd6fe' }; 
  if (r.includes('CALEFACCION') || r.includes('CALEFACCIÓN')) return { bg: '#ea580c', text: '#ffffff', softBg: '#fff7ed', border: '#ffedd5' }; 
  
  const softPalette = [
    { bg: '#4f46e5', text: '#ffffff', softBg: '#eef2ff', border: '#c7d2fe' },
    { bg: '#0d9488', text: '#ffffff', softBg: '#f0fdf4', border: '#bbf7d0' },
    { bg: '#ca8a04', text: '#ffffff', softBg: '#fefce8', border: '#fef08a' },
    { bg: '#9333ea', text: '#ffffff', softBg: '#faf5ff', border: '#e9d5ff' },
    { bg: '#be123c', text: '#ffffff', softBg: '#fff1f2', border: '#fecdd3' }
  ];

  let hash = 0;
  for (let i = 0; i < r.length; i++) {
    hash = r.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % softPalette.length;
  return softPalette[idx];
}

function getRubroShortName(rubro) {
  const r = (rubro || '').toString().toUpperCase();
  if (r.includes('PEQUEÑO') || r.includes('ELECTRO')) return 'PEQ. ELECTR.';
  if (r.includes('TELEVISION') || r.includes('TELEVISIÓN') || r.includes('TV')) return 'TELEVISIÓN';
  if (r.includes('LINEA BLANCA') || r.includes('LÍNEA BLANCA')) return 'L. BLANCA';
  if (r.includes('INFORMATICA') || r.includes('INFORMÁTICA')) return 'INFORMÁTICA';
  if (r.includes('CENTRAL')) return 'AIRE CENTRAL';
  if (r.includes('INDIVIDUAL') || r.includes('SPLIT')) return 'AIRE INDIV.';
  if (r.includes('REPUESTO')) return 'REPUESTOS';
  if (r.length > 12) return r.substring(0, 10) + '...';
  return r;
}

function getBloqueZoneKey(rawPasillo, rawRack) {
  let pStr = (rawPasillo || '').toString().trim().toUpperCase();
  pStr = pStr.replace(/[-_ ]?(UNIDAD(ES)?|FRACCIONADO|-U|U)$/i, '').trim();

  let rStr = (rawRack || '').toString().trim();

  if (/\d+$/.test(pStr)) {
    return pStr;
  }
  if (rStr && rStr !== '-' && rStr !== '0') {
    return `${pStr} ${rStr}`;
  }
  return pStr || 'BLOQUE';
}

function getStagingDockKey(rawPasillo, rawRack, rawZona) {
  let p = (rawPasillo || '').toString().trim().toUpperCase();
  let r = (rawRack || '').toString().trim().toUpperCase();
  let z = (rawZona || '').toString().trim().toUpperCase();

  if (p && r && r !== '-' && r !== '0') {
    return `${p}-${r}`;
  }
  if (p) return p;
  if (z) return z;
  return 'STAGE GENERAL';
}

function changeTab(tab) {
  activeTab = tab;
  selectedRubroFilter = null;

  const tabs = [
    { id: 'tabPenetrable', key: 'PENETRABLE' },
    { id: 'tabSelectivo', key: 'SELECTIVO' },
    { id: 'tabBloque', key: 'BLOQUE' },
    { id: 'tabStageIn', key: 'STAGE_IN' },
    { id: 'tabStageOut', key: 'STAGE_OUT' },
    { id: 'tabInventario', key: 'INVENTARIO' },
    { id: 'tabVolumen', key: 'VOLUMEN' },
    { id: 'tabCalidad', key: 'CALIDAD' }
  ];

  tabs.forEach(t => {
    const btn = document.getElementById(t.id);
    if (!btn) return;
    if (t.key === tab) {
      btn.className = 'px-4 py-2.5 rounded-lg font-black text-xs md:text-sm flex items-center space-x-2 bg-blue-600 text-white shadow';
    } else {
      btn.className = 'px-4 py-2.5 rounded-lg font-black text-xs md:text-sm flex items-center space-x-2 bg-white text-slate-600 hover:bg-slate-200 border border-slate-200';
    }
  });
  
  renderLegend();
  renderMap();
}

function filterByRubro(rubro) {
  if (selectedRubroFilter === rubro) {
    selectedRubroFilter = null;
  } else {
    selectedRubroFilter = rubro;
  }
  renderLegend();
  renderMap();
}

function updatePrintConfig(sizeFormat) {
  if (activeTab === 'SELECTIVO') printConfigSelectivo = sizeFormat;
  else if (activeTab === 'PENETRABLE' || activeTab === 'BLOQUE') printConfigPenetrable = sizeFormat;
  else if (activeTab === 'CALIDAD') printConfigCalidad = sizeFormat;

  if (window.LabelEngine) {
    LabelEngine.updatePrintConfig(sizeFormat);
  }
}

function renderLegend() {
  const legendContainer = document.getElementById('legendContainer');
  if (!legendContainer) return;
  let legendHtml = '';

  let currentRubrosSet = allRubros;
  if (activeTab === 'PENETRABLE') currentRubrosSet = rubrosPenetrable;
  if (activeTab === 'SELECTIVO') currentRubrosSet = rubrosSelectivo;
  if (activeTab === 'BLOQUE') currentRubrosSet = rubrosBloque;
  if (activeTab === 'STAGE_IN' || activeTab === 'STAGE_OUT') currentRubrosSet = rubrosStaging;

  legendHtml += `<span onclick="filterByRubro(null)" class="px-3 py-1.5 rounded shadow-sm flex items-center gap-1.5 border transition cursor-pointer ${selectedRubroFilter === null ? 'bg-slate-900 text-white border-slate-900 font-black' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}"><i class="fa-solid fa-border-all"></i> Todos</span>`;

  currentRubrosSet.forEach(rubro => {
    const styleObj = getRubroColorHex(rubro);
    const isSelected = selectedRubroFilter === rubro;
    const ringStyle = isSelected ? 'ring-4 ring-offset-1 ring-slate-900 font-black scale-105' : 'opacity-90 hover:opacity-100';
    legendHtml += `<span onclick="filterByRubro('${rubro}')" class="px-3 py-1.5 rounded shadow-sm flex items-center gap-1.5 transition cursor-pointer ${ringStyle}" style="background-color: ${styleObj.bg}; color: ${styleObj.text};"><span class="w-2 h-2 rounded-full bg-white opacity-80"></span> ${rubro}</span>`;
  });

  if (activeTab === 'SELECTIVO' || activeTab === 'BLOQUE') {
    legendHtml += `<span class="px-3 py-1.5 rounded bg-zinc-900 text-white shadow-sm flex items-center gap-1.5"><i class="fa-solid fa-layer-group text-amber-400 text-xs"></i> MIX (Multiproducto)</span>`;
  }
  if (activeTab === 'PENETRABLE') {
    legendHtml += `<span class="px-3 py-1.5 rounded bg-rose-700 text-white shadow-sm flex items-center gap-1.5"><i class="fa-solid fa-triangle-exclamation text-yellow-200 text-[10px]"></i> Exceso (>20)</span>`;
  }
  legendHtml += `<span class="px-3 py-1.5 rounded bg-white text-slate-500 border border-slate-200">Vacío</span>`;

  legendContainer.innerHTML = legendHtml;
}

function openRackDetail(pasillo, col, level = null) {
  const isSelectivoMode = (activeTab === 'SELECTIVO');
  const isBloqueMode = (activeTab === 'BLOQUE');
  
  if (isBloqueMode) {
    openFullZoneModal(pasillo);
    return;
  }

  currentOpenRackKey = level !== null ? `${pasillo}-${col}-${level}` : `${pasillo}-${col}`;
  const data = isSelectivoMode ? selectivoTotals[currentOpenRackKey] : rackTotals[currentOpenRackKey];

  const titleEl = document.getElementById('drawerTitle');
  if (titleEl) titleEl.innerText = level !== null ? `${pasillo} ${col} - Estante ${level}` : `${pasillo} ${col}`;
  
  const sizeSelect = document.getElementById('selectPaperSize');
  if (sizeSelect) {
    sizeSelect.value = isSelectivoMode ? printConfigSelectivo : printConfigPenetrable;
    updatePrintConfig(sizeSelect.value);
  }

  const content = document.getElementById('drawerContent');
  if (!content) return;
  content.innerHTML = '';

  const subtitleEl = document.getElementById('drawerSubtitle');

  if (!data || !data.items || data.items.length === 0) {
    if (subtitleEl) subtitleEl.innerText = 'Posición actualmente vacía';
    content.innerHTML = `
      <div class="text-center py-12 space-y-3">
        <i class="fa-solid fa-box-open text-5xl text-slate-300"></i>
        <p class="text-sm text-slate-500 font-bold">No hay stock registrado en esta ubicación.</p>
      </div>`;
  } else {
    const isMixed = data.rubrosSet && data.rubrosSet.size > 1;
    if (subtitleEl) {
      subtitleEl.innerText = isSelectivoMode 
            ? `Total: ${data.totalUnidades} Unidades | ${isMixed ? '⚠️ Mezclado (Multiproducto)' : 'Rubro: ' + Array.from(data.rubrosSet)[0]}`
            : `Total: ${data.total} Pallets Almacenados | Rubro: ${data.rubro}`;
    }

    const itemsToRender = [...data.items];
    itemsToRender.sort((a, b) => {
      if (isSelectivoMode) {
        const skuA = (a['Producto código'] || a['SKU'] || '').toString();
        const skuB = (b['Producto código'] || b['SKU'] || '').toString();
        return skuA.localeCompare(skuB);
      } else {
        const pltA = (a['Pallet'] || a['ID Pallet'] || '').toString();
        const pltB = (b['Pallet'] || b['ID Pallet'] || '').toString();
        return pltA.localeCompare(pltB);
      }
    });

    itemsToRender.forEach((item, idx) => {
      const rawPallet = item['Pallet'] || item['ID Pallet'] || item['LPN'] || '';
      const palletNum = rawPallet ? rawPallet.toString() : 'S/N';
      const prodCode = item['Producto código'] || item['PRODUCTO CODIGO'] || item['SKU'] || 'N/A';
      const prodName = item['Productos nombre'] || item['PRODUCTOS NOMBRE'] || item['Descripcion'] || 'Descripción no disponible';
      const cant = item['Cantidad'] || '1';
      const calidad = (item['Calidad'] || item['CALIDAD'] || 'DISPONIBLE').toString().toUpperCase();
      const itemRubro = (item['Rubro'] || item['RUBRO'] || 'OTROS').toString().toUpperCase();

      const card = document.createElement('div');
      card.className = 'bg-slate-50 border-2 border-slate-200 hover:border-blue-500 rounded-xl p-4 shadow-sm hover:shadow-md transition space-y-2.5 relative overflow-hidden group';

      const styleObj = getRubroColorHex(itemRubro);
      const ubicacionTextoCompleta = level !== null ? `${pasillo} ${col} - Estante ${level}` : (col && col !== '-' ? `${pasillo} ${col}` : `${pasillo}`);

      const safePasillo = escapeHtmlAttr(pasillo);
      const safeCol = escapeHtmlAttr(col);
      const safePallet = escapeHtmlAttr(palletNum);
      const safeSku = escapeHtmlAttr(prodCode);
      const safeName = escapeHtmlAttr(prodName);
      const safeCant = escapeHtmlAttr(cant);
      const safeRubro = escapeHtmlAttr(itemRubro);
      const safeCalidad = escapeHtmlAttr(calidad);

      const printAction = isSelectivoMode 
        ? `LabelEngine.printSingleItemLabel('${safePasillo}', '${safeCol}', '${safeSku}', '${safeName}', '${safeCant}', ${idx + 1}, ${data.items.length}, 'Estante ${level}', '${safeRubro}', '${safeCalidad}')`
        : `LabelEngine.printSingleLabel('${safePasillo}', '${safeCol}', '${safePallet}', '${safeSku}', '${safeName}', '${safeCant}', ${idx + 1}, ${data.total}, '${safeRubro}', '${safeCalidad}')`;

      card.innerHTML = `
        <div class="absolute top-0 left-0 w-2 h-full" style="background-color: ${styleObj.bg};"></div>
        
        <div class="flex justify-between items-start pl-2">
          <div>
            <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              ${isSelectivoMode ? 'CÓDIGO SKU' : 'N° PALLET / ID'}
            </span>
            <h4 class="text-lg font-black text-slate-900 tracking-wide flex items-center gap-2">
              <i class="fa-solid ${isSelectivoMode ? 'fa-tag text-blue-600' : 'fa-barcode text-slate-600'}"></i>
              <span>${isSelectivoMode ? prodCode : palletNum}</span>
            </h4>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
              ${calidad}
            </span>
            <button onclick="${printAction}" class="bg-slate-900 hover:bg-blue-600 text-white p-2 rounded-lg text-xs shadow transition" title="Imprimir Etiqueta">
              <i class="fa-solid fa-print"></i>
            </button>
          </div>
        </div>

        <div class="pl-2 space-y-1 border-t pt-2 border-slate-200">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-500">
              Rubro: <strong style="color: ${styleObj.bg}">${itemRubro}</strong>
            </span>
            <span class="text-xs font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
              <i class="fa-solid fa-boxes-stacked text-slate-500"></i> ${cant} u.
            </span>
          </div>
          <p class="text-xs text-slate-700 font-semibold line-clamp-2">${prodName}</p>
        </div>

        <div class="pl-2 pt-1 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
          <span>${isSelectivoMode ? 'Ítem ' + (idx + 1) + ' de ' + data.items.length : 'Pallet #' + (idx + 1) + ' de ' + data.total}</span>
          <span class="text-blue-600 font-bold">Ubicación: ${ubicacionTextoCompleta}</span>
        </div>
      `;

      content.appendChild(card);
    });
  }

  const printAllBtn = document.getElementById('btnPrintAllRack');
  if (printAllBtn) {
    printAllBtn.setAttribute('onclick', 'LabelEngine.printAllCurrentRack()');
  }

  document.getElementById('drawerOverlay').classList.remove('hidden');
  document.getElementById('drawerPanel').classList.remove('translate-x-full');
}

function openBloqueSubDetail(pasillo, subType) {
  currentOpenRackKey = pasillo;
  const data = bloqueTotals[pasillo];
  if (!data) return;

  const titleEl = document.getElementById('drawerTitle');
  if (titleEl) titleEl.innerText = `Zona: ${pasillo} (${subType === 'pallets' ? 'Pallets con ID' : 'Unidades'})`;
  
  const sizeSelect = document.getElementById('selectPaperSize');
  if (sizeSelect) {
    sizeSelect.value = subType === 'pallets' ? printConfigPenetrable : printConfigSelectivo;
    updatePrintConfig(sizeSelect.value);
  }

  const content = document.getElementById('drawerContent');
  if (!content) return;
  content.innerHTML = '';

  const itemsToRender = [...(subType === 'pallets' ? data.palletsItems : data.unidadesItems)];
  
  itemsToRender.sort((a, b) => {
    if (subType === 'pallets') {
      const pA = (a['Pallet'] || a['ID Pallet'] || '').toString();
      const pB = (b['Pallet'] || b['ID Pallet'] || '').toString();
      return pA.localeCompare(pB);
    } else {
      const sA = (a['Producto código'] || a['SKU'] || '').toString();
      const sB = (b['Producto código'] || b['SKU'] || '').toString();
      return sA.localeCompare(sB);
    }
  });

  const subtitleEl = document.getElementById('drawerSubtitle');

  if (!itemsToRender || itemsToRender.length === 0) {
    if (subtitleEl) subtitleEl.innerText = 'Sin registros en este sector';
    content.innerHTML = `
      <div class="text-center py-12 space-y-3">
        <i class="fa-solid fa-box-open text-5xl text-slate-300"></i>
        <p class="text-sm text-slate-500 font-bold">No hay registros en este sector de la zona.</p>
      </div>`;
  } else {
    if (subtitleEl) subtitleEl.innerText = `Total ítems: ${itemsToRender.length} | Clic para imprimir etiqueta`;

    itemsToRender.forEach((item, idx) => {
      const rawPallet = item['Pallet'] || item['ID Pallet'] || item['LPN'] || '';
      const palletNum = rawPallet ? rawPallet.toString() : 'S/N';
      const prodCode = item['Producto código'] || item['PRODUCTO CODIGO'] || item['SKU'] || 'N/A';
      const prodName = item['Productos nombre'] || item['PRODUCTOS NOMBRE'] || item['Descripcion'] || 'Descripción no disponible';
      const cant = item['Cantidad'] || '1';
      const calidad = (item['Calidad'] || item['CALIDAD'] || 'DISPONIBLE').toString().toUpperCase();
      const itemRubro = (item['Rubro'] || item['RUBRO'] || 'OTROS').toString().toUpperCase();

      const card = document.createElement('div');
      card.className = 'bg-slate-50 border-2 border-slate-200 hover:border-blue-500 rounded-xl p-4 shadow-sm hover:shadow-md transition space-y-2.5 relative overflow-hidden group';

      const styleObj = getRubroColorHex(itemRubro);
      const isPalletItem = (subType === 'pallets');
      const ubicacionTextoCompleta = `Zona: ${pasillo}`;

      const safePasillo = escapeHtmlAttr(pasillo);
      const safePallet = escapeHtmlAttr(palletNum);
      const safeSku = escapeHtmlAttr(prodCode);
      const safeName = escapeHtmlAttr(prodName);
      const safeCant = escapeHtmlAttr(cant);
      const safeRubro = escapeHtmlAttr(itemRubro);
      const safeCalidad = escapeHtmlAttr(calidad);

      const printAction = isPalletItem 
        ? `LabelEngine.printSingleLabel('${safePasillo}', '', '${safePallet}', '${safeSku}', '${safeName}', '${safeCant}', ${idx + 1}, ${itemsToRender.length}, '${safeRubro}', '${safeCalidad}')`
        : `LabelEngine.printSingleItemLabel('${safePasillo}', '', '${safeSku}', '${safeName}', '${safeCant}', ${idx + 1}, ${itemsToRender.length}, 'Zona Bloque', '${safeRubro}', '${safeCalidad}')`;

      card.innerHTML = `
        <div class="absolute top-0 left-0 w-2 h-full" style="background-color: ${styleObj.bg};"></div>
        
        <div class="flex justify-between items-start pl-2">
          <div>
            <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              ${isPalletItem ? 'N° PALLET / ID' : 'CÓDIGO SKU'}
            </span>
            <h4 class="text-lg font-black text-slate-900 tracking-wide flex items-center gap-2">
              <i class="fa-solid ${isPalletItem ? 'fa-barcode text-slate-600' : 'fa-tag text-blue-600'}"></i>
              <span>${isPalletItem ? palletNum : prodCode}</span>
            </h4>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
              ${calidad}
            </span>
            <button onclick="${printAction}" class="bg-slate-900 hover:bg-blue-600 text-white p-2 rounded-lg text-xs shadow transition" title="Imprimir Etiqueta">
              <i class="fa-solid fa-print"></i>
            </button>
          </div>
        </div>

        <div class="pl-2 space-y-1 border-t pt-2 border-slate-200">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-500">
              Rubro: <strong style="color: ${styleObj.bg}">${itemRubro}</strong>
            </span>
            <span class="text-xs font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
              <i class="fa-solid fa-boxes-stacked text-slate-500"></i> ${cant} u.
            </span>
          </div>
          <p class="text-xs text-slate-700 font-semibold line-clamp-2">${prodName}</p>
        </div>

        <div class="pl-2 pt-1 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
          <span>Ítem ${idx + 1} de ${itemsToRender.length}</span>
          <span class="text-blue-600 font-bold">Ubicación: ${ubicacionTextoCompleta}</span>
        </div>
      `;

      content.appendChild(card);
    });
  }

  const printAllBtn = document.getElementById('btnPrintAllRack');
  if (printAllBtn) {
    printAllBtn.setAttribute('onclick', 'LabelEngine.printAllCurrentRack()');
  }

  document.getElementById('drawerOverlay').classList.remove('hidden');
  document.getElementById('drawerPanel').classList.remove('translate-x-full');
}

function openFullZoneModal(zoneKey) {
  currentZoneModalKey = zoneKey;
  currentZoneTabFilter = 'all';
  currentModalSortCriterion = 'sku_asc';
  document.getElementById('modalSearchInput').value = '';
  document.getElementById('modalSortSelect').value = 'sku_asc';
  updateSortHeaderIcons('sku_asc');
  
  document.getElementById('modalZoneTitle').innerText = `Zona de Bloque: ${zoneKey}`;
  document.getElementById('fullZoneModalOverlay').classList.remove('hidden');
  
  renderZoneModalTable();
}

function closeFullZoneModal() {
  document.getElementById('fullZoneModalOverlay').classList.add('hidden');
}

function setZoneTab(tab) {
  currentZoneTabFilter = tab;
  
  document.getElementById('btnZoneTabAll').className = tab === 'all' ? 'px-3.5 py-1.5 rounded-lg bg-blue-600 text-white shadow' : 'px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-200 border';
  document.getElementById('btnZoneTabPallets').className = tab === 'pallets' ? 'px-3.5 py-1.5 rounded-lg bg-blue-600 text-white shadow' : 'px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-200 border';
  document.getElementById('btnZoneTabUnidades').className = tab === 'unidades' ? 'px-3.5 py-1.5 rounded-lg bg-blue-600 text-white shadow' : 'px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-200 border';

  renderZoneModalTable();
}

function changeModalSort(criterion) {
  currentModalSortCriterion = criterion;
  document.getElementById('modalSortSelect').value = criterion;
  updateSortHeaderIcons(criterion);
  renderZoneModalTable();
}

function toggleHeaderSort(field) {
  if (field === 'sku') {
    currentModalSortCriterion = (currentModalSortCriterion === 'sku_asc') ? 'sku_desc' : 'sku_asc';
  } else if (field === 'cant') {
    currentModalSortCriterion = (currentModalSortCriterion === 'cant_desc') ? 'cant_asc' : 'cant_desc';
  } else if (field === 'pallet') {
    currentModalSortCriterion = (currentModalSortCriterion === 'pallet_asc') ? 'pallet_desc' : 'pallet_asc';
  } else if (field === 'desc') {
    currentModalSortCriterion = (currentModalSortCriterion === 'desc_asc') ? 'desc_desc' : 'desc_asc';
  }
  document.getElementById('modalSortSelect').value = currentModalSortCriterion;
  updateSortHeaderIcons(currentModalSortCriterion);
  renderZoneModalTable();
}

function updateSortHeaderIcons(criterion) {
  const icons = {
    pallet: document.getElementById('sortIconPallet'),
    sku: document.getElementById('sortIconSku'),
    desc: document.getElementById('sortIconDesc'),
    cant: document.getElementById('sortIconCant')
  };

  Object.keys(icons).forEach(k => {
    if (icons[k]) icons[k].className = 'fa-solid fa-sort ml-1 opacity-60 text-slate-400';
  });

  if (criterion.startsWith('sku')) {
    icons.sku.className = criterion === 'sku_asc' ? 'fa-solid fa-sort-down ml-1 text-blue-400' : 'fa-solid fa-sort-up ml-1 text-blue-400';
  } else if (criterion.startsWith('cant')) {
    icons.cant.className = criterion === 'cant_desc' ? 'fa-solid fa-sort-down ml-1 text-blue-400' : 'fa-solid fa-sort-up ml-1 text-blue-400';
  } else if (criterion.startsWith('pallet')) {
    icons.pallet.className = criterion === 'pallet_asc' ? 'fa-solid fa-sort-down ml-1 text-blue-400' : 'fa-solid fa-sort-up ml-1 text-blue-400';
  } else if (criterion.startsWith('desc')) {
    icons.desc.className = criterion === 'desc_asc' ? 'fa-solid fa-sort-down ml-1 text-blue-400' : 'fa-solid fa-sort-up ml-1 text-blue-400';
  }
}

function filterZoneTable() {
  renderZoneModalTable();
}

function renderZoneModalTable() {
  if (!currentZoneModalKey || !bloqueTotals[currentZoneModalKey]) return;

  const data = bloqueTotals[currentZoneModalKey];
  const tbody = document.getElementById('modalZoneTableBody');
  tbody.innerHTML = '';

  document.getElementById('countModalAll').innerText = data.items.length;
  document.getElementById('countModalPallets').innerText = data.palletsItems.length;
  document.getElementById('countModalUnidades').innerText = data.unidadesItems.length;

  let sourceList = [...data.items];
  if (currentZoneTabFilter === 'pallets') sourceList = [...data.palletsItems];
  if (currentZoneTabFilter === 'unidades') sourceList = [...data.unidadesItems];

  const searchTerm = document.getElementById('modalSearchInput').value.toLowerCase().trim();

  let filtered = sourceList.filter(it => {
    const prodCode = (it['Producto código'] || it['PRODUCTO CODIGO'] || it['SKU'] || '').toString().toLowerCase();
    const prodName = (it['Productos nombre'] || it['PRODUCTOS NOMBRE'] || it['Descripcion'] || '').toString().toLowerCase();
    const rawPallet = (it['Pallet'] || it['ID Pallet'] || it['LPN'] || '').toString().toLowerCase();
    
    if (!searchTerm) return true;
    return prodCode.includes(searchTerm) || prodName.includes(searchTerm) || rawPallet.includes(searchTerm);
  });

  filtered.sort((a, b) => {
    const skuA = (a['Producto código'] || a['PRODUCTO CODIGO'] || a['SKU'] || '').toString().toUpperCase();
    const skuB = (b['Producto código'] || b['PRODUCTO CODIGO'] || b['SKU'] || '').toString().toUpperCase();
    
    const descA = (a['Productos nombre'] || a['PRODUCTOS NOMBRE'] || a['Descripcion'] || '').toString().toUpperCase();
    const descB = (b['Productos nombre'] || b['PRODUCTOS NOMBRE'] || b['Descripcion'] || '').toString().toUpperCase();

    const cantA = parseInt(a['Cantidad'] || '1');
    const cantB = parseInt(b['Cantidad'] || '1');

    const pltA = (a['Pallet'] || a['ID Pallet'] || a['LPN'] || '').toString().toUpperCase();
    const pltB = (b['Pallet'] || b['ID Pallet'] || b['LPN'] || '').toString().toUpperCase();

    if (currentModalSortCriterion === 'sku_asc') return skuA.localeCompare(skuB);
    if (currentModalSortCriterion === 'sku_desc') return skuB.localeCompare(skuA);
    if (currentModalSortCriterion === 'desc_asc') return descA.localeCompare(descB);
    if (currentModalSortCriterion === 'desc_desc') return descB.localeCompare(descA);
    if (currentModalSortCriterion === 'cant_desc') return cantB - cantA;
    if (currentModalSortCriterion === 'cant_asc') return cantA - cantB;
    if (currentModalSortCriterion === 'pallet_asc') return pltA.localeCompare(pltB);
    if (currentModalSortCriterion === 'pallet_desc') return pltB.localeCompare(pltA);

    return 0;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400 font-bold">No se encontraron registros en este filtro.</td></tr>`;
    return;
  }

  filtered.forEach((it, idx) => {
    const rawPallet = (it['Pallet'] || it['ID Pallet'] || it['LPN'] || '').toString().trim();
    const palletNum = rawPallet ? rawPallet : 'S/N (Fraccionado)';
    const prodCode = it['Producto código'] || it['PRODUCTO CODIGO'] || it['SKU'] || 'N/A';
    const prodName = it['Productos nombre'] || it['PRODUCTOS NOMBRE'] || it['Descripcion'] || 'Descripción no disponible';
    const cant = it['Cantidad'] || '1';
    const itemRubro = (it['Rubro'] || it['RUBRO'] || 'OTROS').toString().toUpperCase();
    const calidad = (it['Calidad'] || it['CALIDAD'] || 'DISPONIBLE').toString().toUpperCase();
    const styleObj = getRubroColorHex(itemRubro);

    const isPallet = rawPallet !== '';

    const safeZoneKey = escapeHtmlAttr(currentZoneModalKey);
    const safePallet = escapeHtmlAttr(palletNum);
    const safeSku = escapeHtmlAttr(prodCode);
    const safeName = escapeHtmlAttr(prodName);
    const safeCant = escapeHtmlAttr(cant);
    const safeRubro = escapeHtmlAttr(itemRubro);
    const safeCalidad = escapeHtmlAttr(calidad);

    const printAction = isPallet 
      ? `LabelEngine.printSingleLabel('${safeZoneKey}', '', '${safePallet}', '${safeSku}', '${safeName}', '${safeCant}', ${idx + 1}, ${filtered.length}, '${safeRubro}', '${safeCalidad}')`
      : `LabelEngine.printSingleItemLabel('${safeZoneKey}', '', '${safeSku}', '${safeName}', '${safeCant}', ${idx + 1}, ${filtered.length}, 'Zona Bloque', '${safeRubro}', '${safeCalidad}')`;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 font-semibold transition';

    tr.innerHTML = `
      <td class="p-3">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${isPallet ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-teal-100 text-teal-800 border border-teal-200'}">
          <i class="fa-solid ${isPallet ? 'fa-barcode' : 'fa-tag'}"></i> ${isPallet ? palletNum : 'Unidad'}
        </span>
      </td>
      <td class="p-3 font-black text-slate-900">${prodCode}</td>
      <td class="p-3 text-slate-700 max-w-xs truncate" title="${prodName}">${prodName}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold text-white" style="background-color: ${styleObj.bg};">${itemRubro}</span>
      </td>
      <td class="p-3 text-center font-black text-slate-800">${cant} u.</td>
      <td class="p-3 text-right">
        <button onclick="${printAction}" class="bg-slate-900 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1 ml-auto">
          <i class="fa-solid fa-print"></i>
          <span>Etiqueta</span>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function closeDrawer() {
  document.getElementById('drawerOverlay').classList.add('hidden');
  document.getElementById('drawerPanel').classList.add('translate-x-full');
}

function showKpiModal(type) {
  if (rawInventoryData.length === 0) {
    alert('Cargá un informe primero para ver las estadísticas operativas.');
    return;
  }

  const modalOverlay = document.getElementById('kpiModalOverlay');
  const modalTitle = document.getElementById('kpiModalTitle');
  const modalBody = document.getElementById('kpiModalBody');
  modalBody.innerHTML = '';

  if (type === 'pallets') {
    modalTitle.innerHTML = `<i class="fa-solid fa-boxes-packing text-blue-400"></i> Desglose de Pallets`;
    modalBody.innerHTML = `
      <p class="text-sm text-slate-600">Total de posiciones con pallets registrados en el depósito.</p>
      <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
        <span class="text-xs font-bold uppercase text-slate-400">Gestión General</span>
        <p class="text-sm font-black text-slate-800">Incluye estibas penetrables y zonas de bloques con ID.</p>
      </div>`;
  } else if (type === 'unidades') {
    modalTitle.innerHTML = `<i class="fa-solid fa-cubes-stacked text-teal-400"></i> Desglose Total de Unidades`;
    modalBody.innerHTML = `
      <p class="text-sm text-slate-600">El inventario total contabiliza <strong class="text-teal-600 text-lg">${document.getElementById('lblTotalUnidades').innerText}</strong> distribuidos entre racks y zonas de bloques.</p>`;
  } else if (type === 'volumen') {
    modalTitle.innerHTML = `<i class="fa-solid fa-cube text-teal-400"></i> Ocupación Volumétrica (m³)`;
    modalBody.innerHTML = `
      <div class="text-center py-4 bg-teal-50 rounded-xl border border-teal-200">
        <span class="text-5xl font-black text-teal-700">${globalTotalVolumenM3.toFixed(2)} m³</span>
        <p class="text-xs text-teal-600 uppercase font-bold mt-2">Volumen Total Almacenado</p>
      </div>
      <p class="text-xs text-slate-500">Calculado a partir de los datos volumétricos validados por SKU o registro del informe de stock.</p>`;
  } else if (type === 'ocupacion') {
    modalTitle.innerHTML = `<i class="fa-solid fa-chart-pie text-emerald-400"></i> Estado de Ocupación del Depósito`;
    let ocText = document.getElementById('lblOcupacion').innerText;
    modalBody.innerHTML = `
      <div class="text-center py-4">
        <span class="text-5xl font-black text-emerald-600">${ocText}</span>
        <p class="text-xs text-slate-400 uppercase font-bold mt-2">Ocupación estimada global</p>
      </div>`;
  } else if (type === 'ubicaciones') {
    modalTitle.innerHTML = `<i class="fa-solid fa-warehouse text-indigo-400"></i> Distribución de Zonas y Pasillos`;
    modalBody.innerHTML = `
      <p class="text-sm text-slate-600">Pasillos Penetrables activos: <strong class="text-slate-900">${activePasillosPenetrable.join(', ') || 'Ninguno'}</strong></p>
      <p class="text-sm text-slate-600 mt-2">Pasillos Selectivos activos: <strong class="text-slate-900">${activePasillosSelectivo.join(', ') || 'Ninguno'}</strong></p>
      <p class="text-sm text-slate-600 mt-2">Zonas de Bloque activas: <strong class="text-slate-900">${activeBloques.join(', ') || 'Ninguno'}</strong></p>
      <p class="text-sm text-slate-600 mt-2">Muelles Staging activos: <strong class="text-slate-900">${activeStagingDocks.join(', ') || 'Ninguno'}</strong></p>`;
  } else if (type === 'rubros') {
    modalTitle.innerHTML = `<i class="fa-solid fa-tags text-amber-400"></i> Rubros Activos en el Depósito`;
    let listHtml = `<ul class="space-y-1.5 text-xs font-bold">`;
    allRubros.forEach(r => {
      let styleObj = getRubroColorHex(r);
      listHtml += `<li class="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200"><span class="w-3 h-3 rounded-full" style="background-color:${styleObj.bg}"></span> ${r}</li>`;
    });
    listHtml += `</ul>`;
    modalBody.innerHTML = listHtml;
  }

  modalOverlay.classList.remove('hidden');
}

function closeKpiModal() {
  document.getElementById('kpiModalOverlay').classList.add('hidden');
}

function updateInventoryCascadeDropdowns() {
  const typeSelect = document.getElementById('invFilterType');
  const pasilloSelect = document.getElementById('invFilterPasillo');
  const calidadSelect = document.getElementById('invFilterCalidad');
  const rubroSelect = document.getElementById('invFilterRubro');

  if (!typeSelect || !pasilloSelect || !calidadSelect || !rubroSelect) return;

  const selectedType = typeSelect.value;
  const selectedPasillo = pasilloSelect.value;
  const selectedCalidad = calidadSelect.value;
  const selectedRubro = rubroSelect.value;

  let filteredForPasillos = rawInventoryData;
  if (selectedType !== 'ALL') {
    filteredForPasillos = rawInventoryData.filter(r => {
      const tipoUbic = (r['Tipo ubicación'] || r['Tipo Ubicacion'] || '').toString().toUpperCase();
      const p = (r['Pasillo'] || '').toString().toUpperCase();
      if (selectedType === 'PENETRABLE') return !tipoUbic.includes('SELECTIVO') && !p.startsWith('B') && !tipoUbic.includes('BLOQUE') && !tipoUbic.includes('STAGE');
      if (selectedType === 'SELECTIVO') return tipoUbic.includes('SELECTIVO');
      if (selectedType === 'BLOQUE') return p.startsWith('B') || tipoUbic.includes('BLOQUE') || tipoUbic.includes('PISO');
      if (selectedType === 'STAGE_IN') return tipoUbic.includes('STAGE') && (tipoUbic.includes('IN') || tipoUbic.includes('RECEPCION'));
      if (selectedType === 'STAGE_OUT') return tipoUbic.includes('STAGE') && (tipoUbic.includes('OUT') || tipoUbic.includes('DESPACHO'));
      return true;
    });
  }

  let pasillosSet = new Set();
  filteredForPasillos.forEach(r => {
    let p = (r['Pasillo'] || '').toString().trim().toUpperCase();
    if (p) {
      const rawRack = (r['Rack'] || r['RACK'] || r['Columna'] || r['Modulo'] || '').toString().trim();
      const rawZona = (r['Zona'] || '').toString().trim();
      const isBloque = p.startsWith('B') || (r['Tipo ubicación'] || '').toString().toUpperCase().includes('BLOQUE');
      const isStaging = (r['Tipo ubicación'] || '').toString().toUpperCase().includes('STAGE');
      pasillosSet.add(isBloque ? getBloqueZoneKey(p, rawRack) : (isStaging ? getStagingDockKey(p, rawRack, rawZona) : p));
    }
  });

  pasilloSelect.innerHTML = `<option value="ALL">Todos los Pasillos (${pasillosSet.size})</option>`;
  Array.from(pasillosSet).sort().forEach(pas => {
    pasilloSelect.innerHTML += `<option value="${pas}">${pas}</option>`;
  });
  if (Array.from(pasillosSet).includes(selectedPasillo)) pasilloSelect.value = selectedPasillo;

  calidadSelect.innerHTML = `<option value="ALL">Todas las Calidades</option>`;
  allCalidades.forEach(cal => {
    calidadSelect.innerHTML += `<option value="${cal}">${cal}</option>`;
  });
  if (allCalidades.has(selectedCalidad)) calidadSelect.value = selectedCalidad;

  rubroSelect.innerHTML = `<option value="ALL">Todos los Rubros</option>`;
  allRubros.forEach(rb => {
    rubroSelect.innerHTML += `<option value="${rb}">${rb}</option>`;
  });
  if (allRubros.has(selectedRubro)) rubroSelect.value = selectedRubro;

  renderInventoryTableBody();
}

function onInventoryFilterChange() {
  updateInventoryCascadeDropdowns();
}

function resetInventoryFilters() {
  document.getElementById('invFilterType').value = 'ALL';
  document.getElementById('invFilterPasillo').value = 'ALL';
  document.getElementById('invFilterCalidad').value = 'ALL';
  document.getElementById('invFilterRubro').value = 'ALL';
  document.getElementById('invSearchInput').value = '';
  updateInventoryCascadeDropdowns();
}

function getNormalizedInventoryRows() {
  const typeSel = document.getElementById('invFilterType')?.value || 'ALL';
  const pasilloInput = (document.getElementById('invFilterPasillo')?.value || '').toUpperCase().trim();
  const calidadSel = document.getElementById('invFilterCalidad')?.value || 'ALL';
  const rubroSel = document.getElementById('invFilterRubro')?.value || 'ALL';
  const searchTxt = (document.getElementById('invSearchInput')?.value || '').toLowerCase().trim();

  let individualRows = [];

  rawInventoryData.forEach((r, idx) => {
    const tipoUbic = (r['Tipo ubicación'] || r['Tipo Ubicacion'] || '').toString().trim().toUpperCase();
    const p = (r['Pasillo'] || '').toString().trim().toUpperCase();
    const rawRack = (r['Rack'] || r['RACK'] || r['Columna'] || r['Modulo'] || '').toString().trim();
    const rawZona = (r['Zona'] || '').toString().trim();
    const rawEstante = (r['Estante'] !== undefined ? r['Estante'] : (r['Nivel'] !== undefined ? r['Nivel'] : '')).toString().trim();
    const codUbic = (r['Cód Ubic.'] || r['Cód. Ubic.'] || r['Cod Ubic'] || '').toString().trim();
    const rubro = (r['Rubro'] || r['RUBRO'] || 'OTROS').toString().trim().toUpperCase();
    const calidad = (r['Calidad'] || r['CALIDAD'] || 'DISPONIBLE').toString().trim().toUpperCase();
    const sku = (r['Producto código'] || r['SKU'] || '').toString().trim();
    const desc = (r['Productos nombre'] || r['Descripcion'] || '').toString().trim();
    
    const rawPallet = (r['Pallet'] || r['ID Pallet'] || r['LPN'] || '').toString().trim();
    const hasPalletId = rawPallet !== '' && rawPallet.toUpperCase() !== 'S/N';

    const isSelectivo = tipoUbic.includes('SELECTIVO');
    const isBloque = p.startsWith('B') || tipoUbic.includes('BLOQUE') || tipoUbic.includes('PISO');
    const isStaging = tipoUbic.includes('STAGE');

    let typeGroup = 'PENETRABLE';
    if (isSelectivo) typeGroup = 'SELECTIVO';
    if (isBloque) typeGroup = 'BLOQUE';
    if (isStaging) typeGroup = 'STAGING';

    if (typeSel === 'STAGE_IN' && (!tipoUbic.includes('STAGE') || (!tipoUbic.includes('IN') && !tipoUbic.includes('RECEPCION')))) return;
    if (typeSel === 'STAGE_OUT' && (!tipoUbic.includes('STAGE') || (!tipoUbic.includes('OUT') && !tipoUbic.includes('DESPACHO')))) return;
    if (typeSel !== 'ALL' && typeSel !== 'STAGE_IN' && typeSel !== 'STAGE_OUT' && typeGroup !== typeSel) return;

    let pasilloKey = p;
    if (isBloque) pasilloKey = getBloqueZoneKey(p, rawRack);
    else if (isStaging) pasilloKey = getStagingDockKey(p, rawRack, rawZona);
    
    if (pasilloInput && pasilloInput !== 'ALL') {
      const allowedPasillos = pasilloInput.split(/[,;\s]+/).filter(Boolean);
      const matchPasillo = allowedPasillos.some(ap => pasilloKey === ap || pasilloKey.startsWith(ap));
      if (!matchPasillo) return;
    }

    if (calidadSel !== 'ALL' && calidad !== calidadSel) return;
    if (rubroSel !== 'ALL' && rubro !== rubroSel) return;

    if (searchTxt) {
      const matchSku = sku.toLowerCase().includes(searchTxt);
      const matchDesc = desc.toLowerCase().includes(searchTxt);
      if (!matchSku && !matchDesc) return;
    }

    let ubicacionFisica = `${p} ${rawRack}`.trim();
    if (isBloque) ubicacionFisica = `Zona Bloque: ${pasilloKey}`;
    else if (isStaging) ubicacionFisica = `Muelle / Staging: ${pasilloKey} (${tipoUbic})`;
    else if (isSelectivo) ubicacionFisica = `${p} ${rawRack} - Estante ${rawEstante}`;
    else if (rawRack && rawRack !== '-') ubicacionFisica = `${p} ${rawRack}`;

    individualRows.push({
      id: idx,
      codUbic: codUbic || '-',
      ubicacion: ubicacionFisica,
      sku: sku || 'N/A',
      desc: desc || 'Sin descripción',
      rubro: rubro,
      calidad: calidad,
      rawCant: parseInt(r['Cantidad'] || 1),
      hasPalletId: hasPalletId,
      rawItem: r
    });
  });

  let palletGroups = {};
  let finalRows = [];

  individualRows.forEach(row => {
    if (row.hasPalletId) {
      const groupKey = `${row.ubicacion}_${row.sku}_${row.calidad}`;
      if (!palletGroups[groupKey]) {
        palletGroups[groupKey] = {
          id: row.id,
          codUbic: row.codUbic,
          ubicacion: row.ubicacion,
          sku: row.sku,
          desc: row.desc,
          rubro: row.rubro,
          calidad: row.calidad,
          palletCount: 0,
          totalUnitsInside: 0,
          hasPalletId: true,
          rawItem: row.rawItem
        };
      }
      palletGroups[groupKey].palletCount += 1;
      palletGroups[groupKey].totalUnitsInside += (isNaN(row.rawCant) ? 0 : row.rawCant);
    } else {
      finalRows.push({
        ...row,
        cant: isNaN(row.rawCant) ? 1 : row.rawCant,
        displayCantHtml: `${isNaN(row.rawCant) ? 1 : row.rawCant} u.`,
        palletCount: 0,
        hasPalletId: false
      });
    }
  });

  Object.keys(palletGroups).forEach(k => {
    const g = palletGroups[k];
    const labelPallet = g.palletCount === 1 ? '1 pallet' : `${g.palletCount} pallets`;
    finalRows.push({
      id: g.id,
      codUbic: g.codUbic,
      ubicacion: g.ubicacion,
      sku: g.sku,
      desc: g.desc,
      rubro: g.rubro,
      calidad: g.calidad,
      cant: g.palletCount,
      displayCantHtml: `${labelPallet} <span class="text-[10px] text-slate-400 block font-normal">(Contenido: ${g.totalUnitsInside.toLocaleString('es-AR')} u.)</span>`,
      hasPalletId: true,
      palletCount: g.palletCount,
      rawItem: g.rawItem
    });
  });

  finalRows.sort((a, b) => {
    let valA = a[inventorySortField];
    let valB = b[inventorySortField];

    if (inventorySortField === 'cant') {
      valA = a.cant;
      valB = b.cant;
    } else {
      valA = (valA || '').toString().toUpperCase();
      valB = (valB || '').toString().toUpperCase();
    }

    if (valA < valB) return inventorySortAsc ? -1 : 1;
    if (valA > valB) return inventorySortAsc ? 1 : -1;
    return 0;
  });

  return finalRows;
}

function sortInventoryTable(field) {
  if (inventorySortField === field) {
    inventorySortAsc = !inventorySortAsc;
  } else {
    inventorySortField = field;
    inventorySortAsc = true;
  }
  renderInventoryTableBody();
}

function renderInventoryTableBody() {
  const tbody = document.getElementById('inventoryTableBody');
  const countLabel = document.getElementById('invRecordCount');
  if (!tbody) return;

  const rows = getNormalizedInventoryRows();
  if (countLabel) countLabel.innerText = `${rows.length} Ítems Filtrados`;

  tbody.innerHTML = '';
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400 font-bold">No se encontraron registros con los filtros seleccionados.</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const styleObj = getRubroColorHex(r.rubro);
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 font-semibold transition';

    tr.innerHTML = `
      <td class="p-3 font-mono font-bold text-slate-600 align-middle">${r.codUbic}</td>
      <td class="p-3 font-black text-slate-900 align-middle">${r.ubicacion}</td>
      <td class="p-3 font-black text-blue-600 align-middle">${r.sku}</td>
      <td class="p-3 text-slate-700 max-w-xs truncate align-middle" title="${r.desc}">${r.desc}</td>
      <td class="p-3 align-middle"><span class="px-2 py-0.5 rounded text-[10px] font-bold text-white" style="background-color: ${styleObj.bg};">${r.rubro}</span></td>
      <td class="p-3 align-middle"><span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">${r.calidad}</span></td>
      <td class="p-3 text-center font-black text-slate-800 align-middle">${r.displayCantHtml}</td>
      <td class="p-3 text-right align-middle">
        <button onclick="LabelEngine.printSingleItemLabelFromInventory('${escapeHtmlAttr(r.sku)}', '${escapeHtmlAttr(r.ubicacion)}')" class="bg-slate-900 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1 ml-auto">
          <i class="fa-solid fa-print"></i>
          <span>Etiqueta</span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function printInventoryReport(isBlindCount) {
  const rows = getNormalizedInventoryRows();
  const printArea = document.getElementById('printArea');
  updatePrintConfig('a4');

  let tableRowsHtml = '';
  rows.forEach((r, idx) => {
    let cantidadSistemaHtml = '';
    if (!isBlindCount) {
      if (r.hasPalletId) {
        cantidadSistemaHtml = r.palletCount === 1 ? '1 pallet' : `${r.palletCount} pallets`;
      } else {
        cantidadSistemaHtml = `${r.cant} u.`;
      }
    }
    
    const sistemaCellHtml = isBlindCount ? '' : `<td style="padding: 6px; text-align: center; font-weight: bold; background-color: #f8fafc; vertical-align: middle;">${cantidadSistemaHtml}</td>`;

    tableRowsHtml += `
      <tr style="border-bottom: 1px solid #cbd5e1; page-break-inside: avoid; break-inside: avoid;">
        <td style="padding: 6px; text-align: center; vertical-align: middle;">${idx + 1}</td>
        <td style="padding: 6px; font-weight: bold; vertical-align: middle;">${r.codUbic}</td>
        <td style="padding: 6px; font-weight: bold; vertical-align: middle;">${r.ubicacion}</td>
        <td style="padding: 6px; font-family: monospace; font-weight: 900; vertical-align: middle;">${r.sku}</td>
        <td style="padding: 6px; vertical-align: middle; line-height: 1.3;">${r.desc}</td>
        <td style="padding: 6px; vertical-align: middle;">${r.rubro}</td>
        ${sistemaCellHtml}
        <td style="padding: 6px; text-align: center; border: 1px dashed #94a3b8; vertical-align: middle;"></td>
        <td style="padding: 6px; text-align: center; border: 1px dashed #94a3b8; vertical-align: middle;"></td>
      </tr>
    `;
  });

  const headerCantidadSistema = isBlindCount ? '' : `<th style="padding: 6px; text-align: center; width: 75px; vertical-align: middle;">Cant. Sist.</th>`;

  printArea.innerHTML = `
    <div style="padding: 8mm; font-family: 'Segoe UI', system-ui, sans-serif; background: #fff; color: #000; width: 100%; box-sizing: border-box;">
      
      <div style="display: flex; justify-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 900; margin: 0; color: #0f172a; text-transform: uppercase;">
            SVGIn® — ${isBlindCount ? 'LISTA DE CONTEO CIEGO' : 'LISTA MAESTRA DE INVENTARIO'}
          </h2>
          <p style="font-size: 11px; margin: 3px 0 0 0; color: #2563eb; font-weight: bold;">
            El inventario a simple vista | Fecha: ${new Date().toLocaleDateString()} | Registros agrupados: ${rows.length}
          </p>
        </div>
        <div style="text-align: right; font-size: 11px; font-weight: bold; color: #334155;">
          <span>Depósito Central — Control Logístico</span>
        </div>
      </div>

      <table class="inv-print-table" style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background: #e2e8f0; border-bottom: 2px solid #0f172a; color: #0f172a; text-transform: uppercase;">
            <th style="padding: 6px; text-align: center; width: 35px; vertical-align: middle;">#</th>
            <th style="padding: 6px; text-align: left; width: 75px; vertical-align: middle;">Cód. Ubic</th>
            <th style="padding: 6px; text-align: left; width: 110px; vertical-align: middle;">Ubicación</th>
            <th style="padding: 6px; text-align: left; width: 100px; vertical-align: middle;">SKU</th>
            <th style="padding: 6px; text-align: left; vertical-align: middle;">Descripción del Producto</th>
            <th style="padding: 6px; text-align: left; width: 90px; vertical-align: middle;">Rubro</th>
            ${headerCantidadSistema}
            <th style="padding: 6px; text-align: center; width: 75px; background-color: #cbd5e1; vertical-align: middle;">Conteo Físico</th>
            <th style="padding: 6px; text-align: center; width: 75px; background-color: #cbd5e1; vertical-align: middle;">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <div class="print-signatures-container" style="margin-top: 30px; display: flex; justify-content: space-between; page-break-inside: avoid; break-inside: avoid;">
        <div style="width: 45%; text-align: center; border-top: 1px solid #0f172a; padding-top: 6px;">
          <p style="font-size: 11px; font-weight: bold; margin: 0; color: #0f172a;">Firma Auditor / Control</p>
          <p style="font-size: 9px; color: #64748b; margin: 2px 0 0 0;">Aclaración: ________________________________</p>
        </div>
        <div style="width: 45%; text-align: center; border-top: 1px solid #0f172a; padding-top: 6px;">
          <p style="font-size: 11px; font-weight: bold; margin: 0; color: #0f172a;">Firma Responsable de Depósito</p>
          <p style="font-size: 9px; color: #64748b; margin: 2px 0 0 0;">Aclaración: ________________________________</p>
        </div>
      </div>

    </div>
  `;

  setTimeout(() => { window.print(); }, 250);
}

function sortQualityTable(field) {
  if (qualitySortField === field) {
    qualitySortAsc = !qualitySortAsc;
  } else {
    qualitySortField = field;
    qualitySortAsc = true;
  }
  renderQualityTableBody();
}

function renderQualityTableBody() {
  const tbody = document.getElementById('qualityTableBody');
  if (!tbody) return;

  const searchTxt = (document.getElementById('qualitySearchInput')?.value || '').toLowerCase().trim();
  let rows = [];

  rawInventoryData.forEach((r, idx) => {
    const tipoUbic = (r['Tipo ubicación'] || r['Tipo Ubicacion'] || '').toString().trim().toUpperCase();
    const p = (r['Pasillo'] || '').toString().trim().toUpperCase();
    const rawRack = (r['Rack'] || r['RACK'] || r['Columna'] || r['Modulo'] || '').toString().trim();
    const rawEstante = (r['Estante'] !== undefined ? r['Estante'] : (r['Nivel'] !== undefined ? r['Nivel'] : '')).toString().trim();
    const codUbic = (r['Cód Ubic.'] || r['Cód. Ubic.'] || r['Cod Ubic'] || '').toString().trim();
    const calidad = (r['Calidad'] || r['CALIDAD'] || 'DISPONIBLE').toString().trim().toUpperCase();
    const sku = (r['Producto código'] || r['SKU'] || '').toString().trim();
    const desc = (r['Productos nombre'] || r['Descripcion'] || '').toString().trim();
    const cant = parseInt(r['Cantidad'] || 1);

    const isSelectivo = tipoUbic.includes('SELECTIVO');
    const isBloque = p.startsWith('B') || tipoUbic.includes('BLOQUE') || tipoUbic.includes('PISO');

    let ubicacionFisica = `${p} ${rawRack}`.trim();
    if (isBloque) ubicacionFisica = `Zona Bloque: ${getBloqueZoneKey(p, rawRack)}`;
    else if (isSelectivo) ubicacionFisica = `${p} ${rawRack} - Estante ${rawEstante}`;
    else if (rawRack && rawRack !== '-') ubicacionFisica = `${p} ${rawRack}`;

    if (searchTxt) {
      const matchSku = sku.toLowerCase().includes(searchTxt);
      const matchDesc = desc.toLowerCase().includes(searchTxt);
      const matchCal = calidad.toLowerCase().includes(searchTxt);
      const matchUbi = ubicacionFisica.toLowerCase().includes(searchTxt);
      if (!matchSku && !matchDesc && !matchCal && !matchUbi) return;
    }

    rows.push({
      id: idx,
      codUbic: codUbic || '-',
      ubicacion: ubicacionFisica,
      sku: sku || 'N/A',
      desc: desc || 'Sin descripción',
      calidad: calidad,
      cant: isNaN(cant) ? 1 : cant
    });
  });

  rows.sort((a, b) => {
    let valA = a[qualitySortField];
    let valB = b[qualitySortField];
    if (qualitySortField === 'cant') {
      valA = parseInt(valA); valB = parseInt(valB);
    } else {
      valA = (valA || '').toString().toUpperCase();
      valB = (valB || '').toString().toUpperCase();
    }
    if (valA < valB) return qualitySortAsc ? -1 : 1;
    if (valA > valB) return qualitySortAsc ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = '';
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400 font-bold">No se encontraron registros de calidad.</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 font-semibold transition';
    tr.innerHTML = `
      <td class="p-3 font-mono font-bold text-slate-600 align-middle">${r.codUbic}</td>
      <td class="p-3 font-black text-slate-900 align-middle">${r.ubicacion}</td>
      <td class="p-3 font-black text-blue-600 align-middle">${r.sku}</td>
      <td class="p-3 text-700 max-w-xs truncate align-middle" title="${r.desc}">${r.desc}</td>
      <td class="p-3 align-middle"><span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">${r.calidad}</span></td>
      <td class="p-3 text-center font-black text-slate-800 align-middle">${r.cant} u.</td>
      <td class="p-3 text-right align-middle">
        <button onclick="LabelEngine.printSingleItemLabelFromInventory('${escapeHtmlAttr(r.sku)}', '${escapeHtmlAttr(r.ubicacion)}')" class="bg-slate-900 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1 ml-auto">
          <i class="fa-solid fa-print"></i>
          <span>Etiqueta</span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMap() {
  const container = document.getElementById('mapContainer');
  if (!container) return;
  container.innerHTML = '';

  if (rawInventoryData.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-100 p-12 rounded-xl shadow-sm border border-slate-200 text-center space-y-3">
        <i class="fa-solid fa-file-excel text-5xl text-blue-600"></i>
        <h3 class="text-xl font-black text-slate-800">Esperando Informe de Stock</h3>
        <p class="text-sm text-slate-500 max-w-md mx-auto">Cargá tu informe de stock en el botón superior para comenzar a operar el depósito.</p>
      </div>`;
    return;
  }

  if (activeTab === 'PENETRABLE') {
    if (activePasillosPenetrable.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-100 p-12 rounded-xl shadow-sm border border-slate-200 text-center space-y-3">
          <i class="fa-solid fa-circle-info text-4xl text-amber-500"></i>
          <h3 class="text-lg font-black text-slate-800">Sin Pasillos Penetrables Detectados</h3>
          <p class="text-sm text-slate-500">El informe cargado no registra posiciones de almacenamiento en Racks Penetrables.</p>
        </div>`;
      return;
    }

    activePasillosPenetrable.forEach(p => {
      const card = document.createElement('div');
      card.className = 'bg-slate-100 p-5 rounded-xl shadow-sm border border-slate-200 space-y-3';

      const columnasPasillo = pasilloColumnsMap[p] || [];
      const minWidthPx = Math.max(1150, columnasPasillo.length * 42);

      let html = `
        <div class="flex justify-between items-center border-b pb-2">
          <h2 class="text-2xl font-black text-slate-900 tracking-wider flex items-center gap-2">
            <span class="w-3.5 h-3.5 rounded-full bg-blue-600 inline-block shadow-sm"></span>
            <span>${p}</span>
          </h2>
          <span class="text-xs text-slate-600 font-extrabold uppercase bg-white px-3 py-1 rounded-full border border-slate-200">
            Racks ${columnasPasillo[0]} a ${columnasPasillo[columnasPasillo.length - 1]} (${columnasPasillo.length} Ubicaciones)
          </span>
        </div>

        <div class="overflow-x-auto custom-scroll pb-2">
          <div class="grid gap-1 text-center" style="min-width: ${minWidthPx}px; grid-template-columns: repeat(${columnasPasillo.length}, minmax(0, 1fr));">
      `;

      columnasPasillo.forEach(c => {
        const rackKey = `${p}-${c}`;
        const data = rackTotals[rackKey];
        const total = data ? data.total : 0;

        const percent = Math.min(100, Math.round((total / MAX_CAPACITY) * 100));
        const isOver = total > MAX_CAPACITY;

        let styleObj = data ? getRubroColorHex(data.rubro) : { bg: '#ffffff', text: '#64748b' };
        let barColor = styleObj.bg;
        let textColor = styleObj.text;
        
        if (isOver) {
          barColor = '#b91c1c';
          textColor = '#ffffff';
        }

        let filterClass = '';
        if (selectedRubroFilter !== null) {
          if (!data || data.rubro.toUpperCase() !== selectedRubroFilter.toUpperCase()) {
            filterClass = 'filtered-out';
          }
        }

        let titleText = `${p} ${c}\n-------------------\nCantidad: ${total} Pallets (${percent}%)\nRubro: ${data ? data.rubro : 'Vacío'}`;
        if (data) {
          if (data.volumenTotal) titleText += `\nVolumen: ${data.volumenTotal.toFixed(2)} m³`;
          if (data.prodCode) titleText += `\nCódigo Prod: ${data.prodCode}`;
          if (data.prodName) titleText += `\nProducto: ${data.prodName}`;
        }

        html += `
          <div class="rack-column flex flex-col items-center group cursor-pointer ${filterClass}" onclick="openRackDetail('${p}', ${c})" title="${titleText}">
            <div class="w-full text-center font-black text-xs text-slate-700 py-1 bg-white rounded-t border border-slate-200 mb-1">
              ${c}
            </div>

            <div class="w-full h-36 bg-white rounded-b border border-slate-200 relative overflow-hidden flex flex-col justify-end shadow-inner">
              <div class="absolute inset-0 flex flex-col justify-around py-2 pointer-events-none z-0">
                <div class="border-b border-slate-200/80 w-full"></div>
                <div class="border-b border-slate-200/80 w-full"></div>
                <div class="border-b border-slate-200/80 w-full"></div>
              </div>

              <div class="w-full transition-all duration-500 ease-out z-10 flex flex-col items-center justify-center ${isOver ? 'ring-2 ring-yellow-400 animate-pulse' : ''}" 
                   style="height: ${percent}%; background-color: ${total > 0 ? barColor : 'transparent'};">
                ${total > 0 ? `<span class="font-black text-[10px] drop-shadow" style="color: ${textColor};">${percent}%</span>` : ''}
              </div>
            </div>
          </div>
        `;
      });

      html += `</div></div>`;
      card.innerHTML = html;
      container.appendChild(card);
    });

  } else if (activeTab === 'SELECTIVO') {
    if (activePasillosSelectivo.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-100 p-12 rounded-xl shadow-sm border border-slate-200 text-center space-y-3">
          <i class="fa-solid fa-table-cells text-5xl text-blue-600"></i>
          <h3 class="text-xl font-black text-slate-800">Módulo de Almacenamiento Selectivo</h3>
          <p class="text-sm text-slate-500 max-w-md mx-auto">No se encontraron pasillos del tipo Selectivo en el informe cargado.</p>
        </div>`;
      return;
    }

    activePasillosSelectivo.forEach(p => {
      const card = document.createElement('div');
      card.className = 'bg-slate-100 p-5 rounded-xl shadow-sm border border-slate-200 space-y-4';

      const columnasPasillo = pasilloSelectivoColumnsMap[p] || [];
      const minWidthPx = Math.max(1150, columnasPasillo.length * 75);
      
      const maxLevel = pasilloSelectivoMaxLevelMap[p] || 6;
      let niveles = [];
      for (let niv = maxLevel; niv >= 1; niv--) {
        niveles.push(niv);
      }

      let html = `
        <div class="flex justify-between items-center border-b pb-2">
          <h2 class="text-2xl font-black text-slate-900 tracking-wider flex items-center gap-2">
            <span class="w-3.5 h-3.5 rounded-full bg-blue-600 inline-block shadow-sm"></span>
            <span>RACK SELECTIVO ${p}</span>
          </h2>
          <span class="text-xs text-slate-600 font-extrabold uppercase bg-white px-3 py-1 rounded-full border border-slate-200">
            ${columnasPasillo.length} Módulos / Racks (${columnasPasillo[0]} a ${columnasPasillo[columnasPasillo.length - 1]}) | Altura: ${maxLevel} Niveles
          </span>
        </div>

        <div class="overflow-x-auto custom-scroll pb-2">
          <div class="space-y-1.5" style="min-width: ${minWidthPx}px;">
            
            <div class="grid gap-1.5 text-center font-black text-xs text-slate-700 bg-white py-1.5 rounded border border-slate-200" 
                 style="grid-template-columns: 80px repeat(${columnasPasillo.length}, minmax(0, 1fr));">
              <div>ESTANTE</div>
              ${columnasPasillo.map(c => `<div>${p} ${c}</div>`).join('')}
            </div>
      `;

      niveles.forEach(niv => {
        const nivLabel = `ESTANTE ${niv}`;
        
        html += `
          <div class="grid gap-1.5 items-center" style="grid-template-columns: 80px repeat(${columnasPasillo.length}, minmax(0, 1fr));">
            <div class="text-[11px] font-black text-slate-600 bg-white py-3 rounded text-center border border-slate-200">
              ${nivLabel}
            </div>
        `;

        columnasPasillo.forEach(c => {
          const key = `${p}-${c}-${niv}`;
          const data = selectivoTotals[key];

          let boxBgClass = 'bg-white border-slate-200 text-slate-400';
          let boxStyle = '';
          let filterClass = '';
          let displayText = '<span class="text-slate-300 font-normal">Vacío</span>';

          if (data && data.items.length > 0) {
            const isMixed = data.rubrosSet.size > 1;

            if (isMixed) {
              boxStyle = 'background-color: #18181b; color: #ffffff;';
              displayText = 'MIX';
            } else {
              const singleRubro = Array.from(data.rubrosSet)[0];
              const styleObj = getRubroColorHex(singleRubro);
              boxStyle = `background-color: ${styleObj.bg}; color: ${styleObj.text};`;
              displayText = getRubroShortName(singleRubro);
            }

            if (selectedRubroFilter !== null) {
              const hasSelectedRubro = Array.from(data.rubrosSet).some(r => r.toUpperCase() === selectedRubroFilter.toUpperCase());
              if (!hasSelectedRubro) {
                filterClass = 'filtered-out';
              }
            }
          } else {
            if (selectedRubroFilter !== null) filterClass = 'filtered-out';
          }

          let tooltipText = data ? `Ubicación: ${p} ${c} (Estante ${niv})\nTotal Unidades: ${data.totalUnidades} u.\nVolumen: ${(data.volumenTotal || 0).toFixed(2)} m³\nRubros: ${Array.from(data.rubrosSet).join(', ')}` : `Ubicación: ${p} ${c} (Estante ${niv}) - Vacío`;

          html += `
            <div onclick="openRackDetail('${p}', ${c}, ${niv})" 
                 class="rack-column p-1.5 h-14 rounded-lg border flex flex-col justify-center items-center cursor-pointer shadow-sm transition-all ${boxBgClass} ${filterClass}" 
                 style="${boxStyle}"
                 title="${tooltipText}">
              
              <div class="text-[10px] font-black tracking-tight text-center px-1 leading-snug truncate w-full">
                ${displayText}
              </div>

            </div>
          `;
        });

        html += `</div>`;
      });

      html += `</div></div>`;
      card.innerHTML = html;
      container.appendChild(card);
    });

  } else if (activeTab === 'BLOQUE') {
    if (activeBloques.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-100 p-12 rounded-xl shadow-sm border border-slate-200 text-center space-y-3">
          <i class="fa-solid fa-square text-5xl text-blue-600"></i>
          <h3 class="text-xl font-black text-slate-800">Módulo de Piso / Bloque</h3>
          <p class="text-sm text-slate-500 max-w-md mx-auto">No se encontraron zonas de bloques o piso en el informe cargado.</p>
        </div>`;
      return;
    }

    const stackContainer = document.createElement('div');
    stackContainer.className = 'space-y-4';

    activeBloques.forEach(zoneKey => {
      const bData = bloqueTotals[zoneKey];
      
      if (selectedRubroFilter !== null) {
        const hasSelectedRubro = bData && Array.from(bData.rubrosSet).some(r => r.toUpperCase() === selectedRubroFilter.toUpperCase());
        if (!hasSelectedRubro) return;
      }

      const card = document.createElement('div');
      const totalPalletsCount = bData ? bData.palletsItems.length : 0;
      const totalUnidadesCount = bData ? bData.unidadesItems.length : 0;
      const totalUnidadesSum = bData ? bData.totalUnidadesSum : 0;
      const totalItemsCount = bData ? bData.items.length : 0;
      const totalVol = bData ? (bData.volumenTotal || 0) : 0;

      let rubroCounts = {};
      let calidadCounts = {};
      if (bData && bData.items) {
        bData.items.forEach(it => {
          let rb = (it['Rubro'] || it['RUBRO'] || 'OTROS').toString().toUpperCase();
          rubroCounts[rb] = (rubroCounts[rb] || 0) + 1;

          let cal = (it['Calidad'] || it['CALIDAD'] || 'DISPONIBLE').toString().toUpperCase();
          calidadCounts[cal] = (calidadCounts[cal] || 0) + 1;
        });
      }

      let predominantRubro = 'OTROS';
      let maxCount = 0;
      Object.keys(rubroCounts).forEach(rb => {
        if (rubroCounts[rb] > maxCount) {
          maxCount = rubroCounts[rb];
          predominantRubro = rb;
        }
      });

      const predStyleObj = getRubroColorHex(predominantRubro);
      
      card.className = 'p-6 rounded-2xl shadow-sm border transition hover:shadow-md space-y-4';
      card.style.backgroundColor = predStyleObj.softBg;
      card.style.borderColor = predStyleObj.border;

      let displayText = 'Vacío';
      const isMixed = bData && bData.rubrosSet.size > 1;
      if (bData && bData.items.length > 0) {
        displayText = isMixed ? 'MIX (Multiproducto)' : Array.from(bData.rubrosSet)[0];
      }

      let rubrosHtml = '';
      Object.keys(rubroCounts).forEach(rb => {
        let count = rubroCounts[rb];
        let pct = Math.round((count / totalItemsCount) * 100);
        let styleObj = getRubroColorHex(rb);
        rubrosHtml += `
          <div class="flex items-center gap-2 bg-white px-3 py-1 rounded-md border border-slate-200 text-xs text-slate-700 shadow-sm">
            <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${styleObj.bg};"></span>
            <span class="font-bold">${rb}:</span>
            <span class="font-black text-slate-900">${pct}%</span>
            <span class="text-[10px] text-slate-500">(${count} ítems)</span>
          </div>
        `;
      });

      let calidadesHtml = '';
      Object.keys(calidadCounts).forEach(cal => {
        let count = calidadCounts[cal];
        let pct = Math.round((count / totalItemsCount) * 100);
        calidadesHtml += `
          <span class="bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-[10px] font-black uppercase">
            ${cal}: ${pct}%
          </span>
        `;
      });

      const safeZoneKey = escapeHtmlAttr(zoneKey);

      card.innerHTML = `
        <div class="flex justify-between items-center border-b pb-3 border-slate-200/80">
          <h2 class="text-xl font-black text-slate-900 tracking-wider flex items-center gap-2">
            <span class="w-3.5 h-3.5 rounded-full inline-block shadow-sm" style="background-color: ${predStyleObj.bg};"></span>
            <span>ZONA DE BLOQUE: ${zoneKey}</span>
          </h2>
          <div class="flex items-center gap-2">
            <span class="text-xs text-teal-800 font-black uppercase bg-teal-100 px-3 py-1 rounded-full border border-teal-200">
              <i class="fa-solid fa-cube mr-1"></i> ${totalVol.toFixed(2)} m³
            </span>
            <span class="text-xs text-slate-600 font-black uppercase bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
              ${totalItemsCount} REGISTROS
            </span>
          </div>
        </div>

        <div class="p-6 rounded-xl border border-slate-200/80 shadow-sm transition-all bg-white/90 space-y-4">
          <div class="flex flex-wrap justify-between items-center gap-4 border-b border-slate-100 pb-3">
            <div class="cursor-pointer" onclick="openFullZoneModal('${safeZoneKey}')">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Zona Principal</span>
              <h3 class="text-3xl font-black text-slate-900">${zoneKey}</h3>
            </div>
            <div class="text-right cursor-pointer" onclick="openFullZoneModal('${safeZoneKey}')">
              <div class="flex items-center justify-end gap-1 mb-1">${calidadesHtml}</div>
              <p class="text-sm font-black truncate max-w-[250px]" style="color: ${predStyleObj.bg}">${displayText}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div onclick="openBloqueSubDetail('${safeZoneKey}', 'pallets')" class="bg-slate-50 hover:bg-blue-50/50 p-4 rounded-xl cursor-pointer transition border border-slate-200 shadow-sm flex justify-between items-center group" title="Ver listado de Pallets con ID">
              <div>
                <span class="block text-slate-400 uppercase text-[10px] font-bold tracking-wider">Pallets (con ID)</span>
                <span class="text-2xl font-black text-slate-900">${totalPalletsCount} <span class="text-xs font-normal text-slate-500">plt</span></span>
              </div>
              <div class="bg-blue-100 group-hover:bg-blue-600 text-blue-600 group-hover:text-white p-3 rounded-xl transition">
                <i class="fa-solid fa-barcode text-xl"></i>
              </div>
            </div>
            
            <div onclick="openBloqueSubDetail('${safeZoneKey}', 'unidades')" class="bg-slate-50 hover:bg-teal-50/50 p-4 rounded-xl cursor-pointer transition border border-slate-200 shadow-sm flex justify-between items-center group" title="Ver listado de Unidades Fraccionadas">
              <div>
                <span class="block text-slate-400 uppercase text-[10px] font-bold tracking-wider">Unidades Fraccionadas</span>
                <span class="text-2xl font-black text-slate-900">${totalUnidadesSum.toLocaleString('es-AR')} <span class="text-xs font-normal text-slate-500">u. (${totalUnidadesCount} ítems)</span></span>
              </div>
              <div class="bg-teal-100 group-hover:bg-teal-600 text-teal-600 group-hover:text-white p-3 rounded-xl transition">
                <i class="fa-solid fa-tag text-xl"></i>
              </div>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[10px] font-bold uppercase text-slate-500"><i class="fa-solid fa-chart-pie mr-1"></i> Desglose de Rubros:</span>
              ${rubrosHtml}
            </div>
            <div class="text-xs text-blue-600 font-bold cursor-pointer hover:underline" onclick="openFullZoneModal('${safeZoneKey}')">
              <i class="fa-solid fa-expand mr-1"></i> Ver stock completo de la zona (Pantalla Grande)
            </div>
          </div>
        </div>
      `;

      stackContainer.appendChild(card);
    });

    container.appendChild(stackContainer);

  } else if (activeTab === 'STAGE_IN') {
    if (activeStagingDocks.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-100 p-12 rounded-xl shadow-sm border border-slate-200 text-center space-y-3">
          <i class="fa-solid fa-circle-down text-5xl text-amber-500"></i>
          <h3 class="text-xl font-black text-slate-800">Módulo STAGE IN (Recepción)</h3>
          <p class="text-sm text-slate-500 max-w-md mx-auto">No se encontraron registros de recepción en el informe cargado.</p>
        </div>`;
      return;
    }

    const stagingCard = document.createElement('div');
    stagingCard.className = 'space-y-4 max-w-6xl mx-auto';

    let html = `
      <div class="border-b pb-4 border-slate-200 mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-black text-slate-900 tracking-wider flex items-center gap-2">
            <i class="fa-solid fa-circle-down text-amber-500"></i>
            <span>MONITOREO DE RECEPCIÓN (STAGE IN)</span>
          </h2>
          <p class="text-xs text-slate-500 mt-1">Control exclusivo de calles y muelles de descarga y recepción de mercadería.</p>
        </div>
      </div>
    `;

    activeStagingDocks.forEach(dock => {
      const data = stagingTotals[dock];
      const inRows = data ? data.inRows : [];
      if (inRows.length === 0) return;

      const totalInUnits = inRows.reduce((acc, r) => acc + (parseInt(r['Cantidad'] || r['CANTIDAD'] || 1)), 0);
      const totalInPallets = new Set(inRows.map(r => r['ID Pallet'] || r['Pallet']).filter(Boolean)).size;

      let isInSelected = selectedRubroFilter !== null && inRows.some(r => (r['Rubro'] || r['RUBRO'] || '').toString().toUpperCase() === selectedRubroFilter.toUpperCase());
      let filterStyle = (selectedRubroFilter !== null && !isInSelected) ? 'opacity-40' : '';

      html += `
      <div class="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 space-y-4 mb-4 transition shadow-md ${filterStyle}">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center space-x-3">
            <div class="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
              <i class="fa-solid fa-circle-down text-2xl"></i>
            </div>
            <div>
              <h3 class="font-black text-xl uppercase tracking-wider text-amber-400">MUELLE / CALLE: ${dock}</h3>
              <span class="text-xs text-slate-400">Total recepcionado: <strong class="text-white font-bold">${totalInUnits.toLocaleString('es-AR')} u.</strong></span>
            </div>
          </div>
          <span class="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-full">RECEPCIÓN ACTIVA</span>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-black text-amber-400 uppercase tracking-wider">DETALLE STAGE IN</span>
            <span class="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">${inRows.length} Registros</span>
          </div>
          <div class="flex items-baseline justify-between">
            <div><span class="text-3xl font-black text-amber-400">${totalInUnits.toLocaleString('es-AR')}</span><span class="text-xs text-slate-400 font-bold ml-1">unidades</span></div>
            <div class="text-xs text-slate-300 font-bold bg-slate-900 px-2.5 py-1 rounded border border-slate-700">Pallets: <strong class="text-white">${totalInPallets}</strong></div>
          </div>
        </div>
      </div>
      `;
    });

    stagingCard.innerHTML = html;
    container.appendChild(stagingCard);

  } else if (activeTab === 'STAGE_OUT') {
    if (activeStagingDocks.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-100 p-12 rounded-xl shadow-sm border border-slate-200 text-center space-y-3">
          <i class="fa-solid fa-circle-up text-5xl text-amber-600"></i>
          <h3 class="text-xl font-black text-slate-800">Módulo STAGE OUT (Despacho)</h3>
          <p class="text-sm text-slate-500 max-w-md mx-auto">No se encontraron registros de despacho en el informe cargado.</p>
        </div>`;
      return;
    }

    const stagingCard = document.createElement('div');
    stagingCard.className = 'space-y-4 max-w-6xl mx-auto';

    let html = `
      <div class="border-b pb-4 border-slate-200 mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-black text-slate-900 tracking-wider flex items-center gap-2">
            <i class="fa-solid fa-circle-up text-amber-600"></i>
            <span>MONITOREO DE DESPACHO (STAGE OUT)</span>
          </h2>
          <p class="text-xs text-slate-500 mt-1">Control exclusivo de calles de preconsolidado, staging de salida y expedición.</p>
        </div>
      </div>
    `;

    activeStagingDocks.forEach(dock => {
      const data = stagingTotals[dock];
      const outRows = data ? data.outRows : [];
      if (outRows.length === 0) return;

      const totalOutUnits = outRows.reduce((acc, r) => acc + (parseInt(r['Cantidad'] || r['CANTIDAD'] || 1)), 0);
      const totalOutPallets = new Set(outRows.map(r => r['ID Pallet'] || r['Pallet']).filter(Boolean)).size;

      let isOutSelected = selectedRubroFilter !== null && outRows.some(r => (r['Rubro'] || r['RUBRO'] || '').toString().toUpperCase() === selectedRubroFilter.toUpperCase());
      let filterStyle = (selectedRubroFilter !== null && !isOutSelected) ? 'opacity-40' : '';

      html += `
      <div class="bg-amber-100/80 text-slate-900 p-6 rounded-2xl border border-amber-300 space-y-4 mb-4 shadow-sm transition ${filterStyle}">
        <div class="flex items-center justify-between pb-3 border-b border-amber-300">
          <div class="flex items-center space-x-3">
            <div class="p-2.5 bg-amber-500/20 text-amber-800 border border-amber-400 rounded-xl">
              <i class="fa-solid fa-circle-up text-2xl"></i>
            </div>
            <div>
              <h3 class="font-black text-xl uppercase tracking-wider text-slate-900">MUELLE / CALLE: ${dock}</h3>
              <span class="text-xs text-slate-700 font-bold">Total a despachar: <strong class="text-slate-900">${totalOutUnits.toLocaleString('es-AR')} u.</strong></span>
            </div>
          </div>
          <span class="px-3 py-1 bg-amber-600 text-white text-xs font-black rounded-full">DESPACHO PREPARADO</span>
        </div>

        <div class="bg-[#FFE600] p-4 rounded-xl border border-yellow-400 shadow-sm">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-black text-slate-900 uppercase tracking-wider">DETALLE STAGE OUT</span>
            <span class="text-[10px] bg-slate-900 text-[#FFE600] px-2 py-0.5 rounded font-black">${outRows.length} Registros</span>
          </div>
          <div class="flex items-baseline justify-between text-slate-900">
            <div><span class="text-3xl font-black">${totalOutUnits.toLocaleString('es-AR')}</span><span class="text-xs font-bold ml-1">unidades</span></div>
            <div class="text-xs font-bold bg-white/80 px-2.5 py-1 rounded border border-yellow-300">Pallets: <strong class="text-slate-900">${totalOutPallets}</strong></div>
          </div>
        </div>
      </div>
      `;
    });

    stagingCard.innerHTML = html;
    container.appendChild(stagingCard);

  } else if (activeTab === 'INVENTARIO') {
    const invCard = document.createElement('div');
    invCard.className = 'bg-slate-100 p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6';

    let invHtml = `
      <div class="flex flex-wrap justify-between items-center border-b pb-4 border-slate-200 gap-4">
        <div>
          <h2 class="text-2xl font-black text-slate-900 tracking-wider flex items-center gap-2">
            <i class="fa-solid fa-boxes-stacked text-blue-600"></i>
            <span>LISTADO COMPLETO Y CONSOLIDADO DE INVENTARIO</span>
          </h2>
          <p class="text-xs text-slate-500 mt-1">Monitoreo global de stock con filtros cruzados, ordenamiento dinámico y reportes de impresión.</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="printInventoryReport(false)" class="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-black text-xs shadow flex items-center gap-2 transition">
            <i class="fa-solid fa-print"></i>
            <span>Imprimir Lista Maestra</span>
          </button>
          <button onclick="printInventoryReport(true)" class="bg-amber-500 hover:bg-amber-600 text-slate-900 px-4 py-2.5 rounded-xl font-black text-xs shadow flex items-center gap-2 transition">
            <i class="fa-solid fa-eye-slash"></i>
            <span>Conteo Ciego</span>
          </button>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <select id="invFilterType" onchange="onInventoryFilterChange()" class="bg-slate-100 text-slate-800 text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="ALL">Todos los Tipos</option>
            <option value="PENETRABLE">Solo Penetrable</option>
            <option value="SELECTIVO">Solo Selectivo</option>
            <option value="BLOQUE">Solo Piso / Bloque</option>
            <option value="STAGE_IN">Solo STAGE IN (Recepción)</option>
            <option value="STAGE_OUT">Solo STAGE OUT (Despacho)</option>
          </select>
          <select id="invFilterPasillo" onchange="onInventoryFilterChange()" class="bg-slate-100 text-slate-800 text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="ALL">Todos los Pasillos</option>
          </select>
          <select id="invFilterCalidad" onchange="onInventoryFilterChange()" class="bg-slate-100 text-slate-800 text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="ALL">Todas las Calidades</option>
          </select>
          <select id="invFilterRubro" onchange="onInventoryFilterChange()" class="bg-slate-100 text-slate-800 text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="ALL">Todos los Rubros</option>
          </select>
          <button onclick="resetInventoryFilters()" class="text-xs font-bold text-rose-600 hover:text-rose-800 underline ml-1">
            Limpiar filtros
          </button>
        </div>

        <div class="flex items-center gap-2 w-full lg:w-72">
          <span class="text-slate-400"><i class="fa-solid fa-magnifying-glass"></i></span>
          <input type="text" id="invSearchInput" oninput="renderInventoryTableBody()" placeholder="🔍 Buscar SKU o Descripción..." class="w-full bg-slate-100 text-slate-800 text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
      </div>

      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div class="flex justify-between items-center text-xs text-slate-500 font-bold">
          <span id="invRecordCount">0 Ítems Filtrados</span>
          <span>Hacé clic en los encabezados para ordenar</span>
        </div>

        <div class="overflow-x-auto custom-scroll">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-900 text-white border-b uppercase text-[10px] tracking-wider select-none">
                <th onclick="sortInventoryTable('codUbic')" class="p-3 rounded-l-lg cursor-pointer hover:bg-slate-800 transition">Cód. Ubic <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th onclick="sortInventoryTable('ubicacion')" class="p-3 cursor-pointer hover:bg-slate-800 transition">Ubicación Física <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th onclick="sortInventoryTable('sku')" class="p-3 cursor-pointer hover:bg-slate-800 transition">SKU <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th onclick="sortInventoryTable('desc')" class="p-3 cursor-pointer hover:bg-slate-800 transition">Descripción del Producto <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th onclick="sortInventoryTable('rubro')" class="p-3 cursor-pointer hover:bg-slate-800 transition">Rubro <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th onclick="sortInventoryTable('calidad')" class="p-3 cursor-pointer hover:bg-slate-800 transition">Calidad <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th onclick="sortInventoryTable('cant')" class="p-3 text-center cursor-pointer hover:bg-slate-800 transition">Cantidad / Stock <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th class="p-3 text-right rounded-r-lg">Acción</th>
              </tr>
            </thead>
            <tbody id="inventoryTableBody" class="divide-y divide-slate-200"></tbody>
          </table>
        </div>
      </div>
    `;

    invCard.innerHTML = invHtml;
    container.appendChild(invCard);
    updateInventoryCascadeDropdowns();

} else if (activeTab === 'VOLUMEN') {
    const volCard = document.createElement('div');
    volCard.className = 'bg-slate-100 p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6';

    let filteredVolumen = globalTotalVolumenM3;
    if (selectedRubroFilter !== null) {
      filteredVolumen = 0;
      rawInventoryData.forEach(row => {
        const r = (row['Rubro'] || row['RUBRO'] || 'OTROS').toString().toUpperCase();
        if (r === selectedRubroFilter.toUpperCase()) {
          const rawVol = row['Volumen Total'] !== undefined ? row['Volumen Total'] : (row['Volumen'] !== undefined ? row['Volumen'] : (row['VOLUMEN'] || 0));
          let v = parseFloat(rawVol || 0);
          if (v <= 50) filteredVolumen += v;
        }
      });
    }

    let volHtml = `
      <div class="flex flex-wrap justify-between items-center border-b pb-4 border-slate-200 gap-4">
        <div>
          <h2 class="text-2xl font-black text-slate-900 tracking-wider flex items-center gap-2">
            <i class="fa-solid fa-cube text-teal-600"></i>
            <span>ANÁLISIS DE VOLUMEN POR UBICACIÓN (m³)</span>
          </h2>
          <p class="text-xs text-slate-500 mt-1">Ocupación cúbica distribuida por Pasillos Penetrables, Racks Selectivos y Bloques.</p>
        </div>
        <div class="bg-teal-600 text-white px-5 py-3 rounded-xl font-black text-lg shadow flex items-center gap-2">
          <i class="fa-solid fa-cubes"></i>
          <span>${filteredVolumen.toFixed(2)} m³ ${selectedRubroFilter ? '('+selectedRubroFilter+')' : 'TOTAL'}</span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    `;

    let volPenet = 0;
    let penetList = '';
    activePasillosPenetrable.forEach(p => {
      let pasVol = 0;
      (pasilloColumnsMap[p] || []).forEach(c => {
        const data = rackTotals[`${p}-${c}`];
        if (data && data.items) {
          data.items.forEach(it => {
            const r = (it['Rubro'] || it['RUBRO'] || 'OTROS').toString().toUpperCase();
            if (selectedRubroFilter === null || r === selectedRubroFilter.toUpperCase()) {
              const rawVol = it['Volumen Total'] !== undefined ? it['Volumen Total'] : (it['Volumen'] !== undefined ? it['Volumen'] : (it['VOLUMEN'] || 0));
              let v = parseFloat(rawVol || 0);
              if (v <= 50) pasVol += v;
            }
          });
        }
      });
      if (selectedRubroFilter === null || pasVol > 0) {
        volPenet += pasVol;
        penetList += `
          <div class="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200 text-xs font-bold">
            <span class="text-slate-800">${p}</span>
            <span class="text-teal-700 font-black">${pasVol.toFixed(2)} m³</span>
          </div>`;
      }
    });

    volHtml += `
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex justify-between items-center border-b pb-2">
          <h3 class="font-black text-slate-900 text-sm flex items-center gap-2"><i class="fa-solid fa-cubes text-blue-600"></i> Penetrable</h3>
          <span class="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">${volPenet.toFixed(2)} m³</span>
        </div>
        <div class="space-y-2 max-h-72 overflow-y-auto custom-scroll pr-1">${penetList || '<p class="text-xs text-slate-400">Sin datos para este rubro</p>'}</div>
      </div>
    `;

    let volSelect = 0;
    let selectList = '';
    activePasillosSelectivo.forEach(p => {
      let pasVol = 0;
      const maxLvl = pasilloSelectivoMaxLevelMap[p] || 6;
      (pasilloSelectivoColumnsMap[p] || []).forEach(c => {
        for(let niv = 1; niv <= maxLvl; niv++) {
          const data = selectivoTotals[`${p}-${c}-${niv}`];
          if (data && data.items) {
            data.items.forEach(it => {
              const r = (it['Rubro'] || it['RUBRO'] || 'OTROS').toString().toUpperCase();
              if (selectedRubroFilter === null || r === selectedRubroFilter.toUpperCase()) {
                const rawVol = it['Volumen Total'] !== undefined ? it['Volumen Total'] : (it['Volumen'] !== undefined ? it['Volumen'] : (it['VOLUMEN'] || 0));
                let v = parseFloat(rawVol || 0);
                if (v <= 50) pasVol += v;
              }
            });
          }
        }
      });
      if (selectedRubroFilter === null || pasVol > 0) {
        volSelect += pasVol;
        selectList += `
          <div class="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200 text-xs font-bold">
            <span class="text-slate-800">Rack ${p}</span>
            <span class="text-teal-700 font-black">${pasVol.toFixed(2)} m³</span>
          </div>`;
      }
    });

    volHtml += `
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex justify-between items-center border-b pb-2">
          <h3 class="font-black text-slate-900 text-sm flex items-center gap-2"><i class="fa-solid fa-table-cells text-blue-600"></i> Selectivo</h3>
          <span class="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">${volSelect.toFixed(2)} m³</span>
        </div>
        <div class="space-y-2 max-h-72 overflow-y-auto custom-scroll pr-1">${selectList || '<p class="text-xs text-slate-400">Sin datos para este rubro</p>'}</div>
      </div>
    `;

    let volBloq = 0;
    let bloqList = '';
    activeBloques.forEach(z => {
      const bData = bloqueTotals[z];
      let zVol = 0;
      if (bData && bData.items) {
        bData.items.forEach(it => {
          const r = (it['Rubro'] || it['RUBRO'] || 'OTROS').toString().toUpperCase();
          if (selectedRubroFilter === null || r === selectedRubroFilter.toUpperCase()) {
            const rawVol = it['Volumen Total'] !== undefined ? it['Volumen Total'] : (it['Volumen'] !== undefined ? it['Volumen'] : (it['VOLUMEN'] || 0));
            let v = parseFloat(rawVol || 0);
            if (v <= 50) zVol += v;
          }
        });
      }
      if (selectedRubroFilter === null || zVol > 0) {
        volBloq += zVol;
        bloqList += `
          <div class="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200 text-xs font-bold">
            <span class="text-slate-800">Zona ${z}</span>
            <span class="text-teal-700 font-black">${zVol.toFixed(2)} m³</span>
          </div>`;
      }
    });

    volHtml += `
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex justify-between items-center border-b pb-2">
          <h3 class="font-black text-slate-900 text-sm flex items-center gap-2"><i class="fa-solid fa-square text-blue-600"></i> Piso / Bloque</h3>
          <span class="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">${volBloq.toFixed(2)} m³</span>
        </div>
        <div class="space-y-2 max-h-72 overflow-y-auto custom-scroll pr-1">${bloqList || '<p class="text-xs text-slate-400">Sin datos para este rubro</p>'}</div>
      </div>
    `;

    volHtml += `</div>`;
    volCard.innerHTML = volHtml;
    container.appendChild(volCard);

  } else if (activeTab === 'CALIDAD') {
    const calCard = document.createElement('div');
    calCard.className = 'bg-slate-100 p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6';

    let calHtml = `
      <div class="flex flex-wrap justify-between items-center border-b pb-4 border-slate-200 gap-4">
        <div>
          <h2 class="text-2xl font-black text-slate-900 tracking-wider flex items-center gap-2">
            <i class="fa-solid fa-circle-check text-emerald-600"></i>
            <span>PANEL DE INVENTARIO Y CONTROL DE CALIDAD</span>
          </h2>
          <p class="text-xs text-slate-500 mt-1">Planilla de auditoría detallada por SKU, estado de calidad y ubicación física.</p>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div class="flex items-center gap-2 w-full md:w-96">
          <span class="text-slate-400"><i class="fa-solid fa-magnifying-glass"></i></span>
          <input type="text" id="qualitySearchInput" oninput="renderQualityTableBody()" placeholder="🔍 Buscar por SKU, Calidad o Ubicación..." class="w-full bg-slate-100 text-slate-800 text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="text-xs font-bold text-slate-500">
          Hacé clic en los encabezados de la tabla para ordenar.
        </div>
      </div>

      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div class="overflow-x-auto custom-scroll">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-900 text-white border-b uppercase text-[10px] tracking-wider select-none">
                <th onclick="sortQualityTable('codUbic')" class="p-3 rounded-l-lg cursor-pointer hover:bg-slate-800 transition">Cód. Ubic. <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th onclick="sortQualityTable('ubicacion')" class="p-3 cursor-pointer hover:bg-slate-800 transition">Ubicación Física <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th onclick="sortQualityTable('sku')" class="p-3 cursor-pointer hover:bg-slate-800 transition">SKU <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th onclick="sortQualityTable('desc')" class="p-3 cursor-pointer hover:bg-slate-800 transition">Descripción del Producto <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th onclick="sortQualityTable('calidad')" class="p-3 cursor-pointer hover:bg-slate-800 transition">Calidad / Estado <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th onclick="sortQualityTable('cant')" class="p-3 text-center cursor-pointer hover:bg-slate-800 transition">Cantidad <i class="fa-solid fa-sort ml-1 opacity-60"></i></th>
                <th class="p-3 text-right rounded-r-lg">Acción</th>
              </tr>
            </thead>
            <tbody id="qualityTableBody" class="divide-y divide-slate-200"></tbody>
          </table>
        </div>
      </div>
    `;

    calCard.innerHTML = calHtml;
    container.appendChild(calCard);
    renderQualityTableBody();
  }
}

const fileInputEl = document.getElementById('fileInput');
if (fileInputEl) {
  fileInputEl.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, {type: 'array', cellDates: true});
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, {defval: ''});

        if (!json || json.length === 0) {
          alert('El archivo cargado parece estar vacío.');
          return;
        }

        rawInventoryData = json;
        window.rawInventoryData = json;

        rackTotals = {};
        selectivoTotals = {};
        bloqueTotals = {};
        stagingTotals = {};
        pasilloColumnsMap = {};
        pasilloSelectivoColumnsMap = {};
        pasilloSelectivoMaxLevelMap = {};
        
        let totalPallets = 0;
        let totalUnidadesSum = 0;
        globalTotalVolumenM3 = 0;

        allRubros.clear();
        allCalidades.clear();
        rubrosPenetrable.clear();
        rubrosSelectivo.clear();
        rubrosBloque.clear();
        rubrosStaging.clear();

        let pasillosPenetrablesSet = new Set();
        let pasillosSelectivosSet = new Set();
        let bloquesSet = new Set();
        let stagingDocksSet = new Set();

        let penColSets = {};
        let selColSets = {};

        json.forEach(row => {
          const tipoUbicacion = (row['Tipo ubicación'] || row['Tipo Ubicacion'] || row['TIPO UBICACION'] || '').toString().trim().toUpperCase();
          const p = (row['Pasillo'] || row['PASILLO'] || '').toString().trim().toUpperCase();
          const rawRack = (row['Rack'] || row['RACK'] || row['Columna'] || row['Modulo'] || '').toString().trim();
          const rawZona = (row['Zona'] || '').toString().trim();
          const colVal = parseInt(rawRack || 0);
          
          const rawEstante = row['Estante'] !== undefined ? row['Estante'] : (row['Nivel'] !== undefined ? row['Nivel'] : row['Estante ']);
          const levelVal = (rawEstante !== '' && rawEstante !== null && !isNaN(parseInt(rawEstante))) ? parseInt(rawEstante) : null;
          
          const r = (row['Rubro'] || row['RUBRO'] || 'OTROS').toString().trim().toUpperCase();
          const cal = (row['Calidad'] || row['CALIDAD'] || 'DISPONIBLE').toString().trim().toUpperCase();
          const prodCode = (row['Producto código'] || row['PRODUCTO CODIGO'] || row['SKU'] || '').toString().trim();
          const prodName = (row['Productos nombre'] || row['PRODUCTOS NOMBRE'] || row['Descripcion'] || '').toString().trim();
          const cantVal = parseInt(row['Cantidad'] || row['CANTIDAD'] || 1);
          const rawPallet = (row['Pallet'] || row['ID Pallet'] || row['LPN'] || '').toString().trim();

          const rawVol = row['Volumen Total'] !== undefined ? row['Volumen Total'] : (row['Volumen'] !== undefined ? row['Volumen'] : (row['VOLUMEN'] || 0));
          let volVal = parseFloat(rawVol || 0);
          if (volVal > 50) volVal = 0;

          globalTotalVolumenM3 += volVal;

          if (p || tipoUbicacion.includes('STAGE')) {
            allRubros.add(r);
            allCalidades.add(cal);
            totalUnidadesSum += cantVal;

            const isSelectivo = tipoUbicacion.includes('SELECTIVO');
            const isBloque = p.startsWith('B') || tipoUbicacion.includes('BLOQUE') || tipoUbicacion.includes('PISO');
            const isStaging = tipoUbicacion.includes('STAGE');

            if (isStaging) {
              rubrosStaging.add(r);
              const dockKey = getStagingDockKey(p, rawRack, rawZona);
              stagingDocksSet.add(dockKey);

              if (!stagingTotals[dockKey]) {
                stagingTotals[dockKey] = { dockName: dockKey, inRows: [], outRows: [], rubrosSet: new Set() };
              }
              stagingTotals[dockKey].rubrosSet.add(r);

              if (tipoUbicacion.includes('IN') || tipoUbicacion.includes('RECEPCION')) {
                stagingTotals[dockKey].inRows.push(row);
              } else {
                stagingTotals[dockKey].outRows.push(row);
              }
            } else if (isBloque) {
              rubrosBloque.add(r);
              const zoneKey = getBloqueZoneKey(p, rawRack);
              bloquesSet.add(zoneKey);

              if (!bloqueTotals[zoneKey]) {
                bloqueTotals[zoneKey] = {
                  pasillo: zoneKey,
                  totalUnidadesSum: 0,
                  volumenTotal: 0,
                  palletsItems: [],
                  unidadesItems: [],
                  rubrosSet: new Set(),
                  items: []
                };
              }

              bloqueTotals[zoneKey].volumenTotal += volVal;

              if (rawPallet) {
                bloqueTotals[zoneKey].palletsItems.push(row);
                totalPallets += 1;
              } else {
                bloqueTotals[zoneKey].unidadesItems.push(row);
                bloqueTotals[zoneKey].totalUnidadesSum += cantVal;
              }

              bloqueTotals[zoneKey].rubrosSet.add(r);
              bloqueTotals[zoneKey].items.push(row);

            } else if (isSelectivo) {
              rubrosSelectivo.add(r);
              pasillosSelectivosSet.add(p);
              if (!selColSets[p]) selColSets[p] = new Set();
              selColSets[p].add(colVal);

              const lev = levelVal !== null ? levelVal : 0;
              if (lev > 0) {
                if (!pasilloSelectivoMaxLevelMap[p] || lev > pasilloSelectivoMaxLevelMap[p]) {
                  pasilloSelectivoMaxLevelMap[p] = lev;
                }

                const selectKey = `${p}-${colVal}-${lev}`;

                if (!selectivoTotals[selectKey]) {
                  selectivoTotals[selectKey] = {
                    pasillo: p,
                    col: colVal,
                    level: lev,
                    totalUnidades: 0,
                    volumenTotal: 0,
                    rubrosSet: new Set(),
                    items: []
                  };
                }
                selectivoTotals[selectKey].totalUnidades += cantVal;
                selectivoTotals[selectKey].volumenTotal += volVal;
                selectivoTotals[selectKey].rubrosSet.add(r);
                selectivoTotals[selectKey].items.push(row);
              }

            } else {
              rubrosPenetrable.add(r);
              pasillosPenetrablesSet.add(p);
              if (!penColSets[p]) penColSets[p] = new Set();
              penColSets[p].add(colVal);

              const rackKey = `${p}-${colVal}`;
              if (!rackTotals[rackKey]) {
                rackTotals[rackKey] = {
                  pasillo: p,
                  col: colVal,
                  total: 0,
                  volumenTotal: 0,
                  rubro: r,
                  prodCode: prodCode,
                  prodName: prodName,
                  items: []
                };
              }
              rackTotals[rackKey].total += 1;
              rackTotals[rackKey].volumenTotal += volVal;
              rackTotals[rackKey].items.push(row);
              totalPallets += 1;
            }
          }
        });

        activePasillosPenetrable = Array.from(pasillosPenetrablesSet).sort();
        activePasillosSelectivo = Array.from(pasillosSelectivosSet).sort();
        activeBloques = Array.from(bloquesSet).sort();
        
        activeStagingDocks = Array.from(stagingDocksSet).sort((a, b) => {
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        Object.keys(penColSets).forEach(pas => {
          const sortedCols = Array.from(penColSets[pas]).sort((a, b) => a - b);
          const minObserved = sortedCols[0];
          const maxCol = sortedCols[sortedCols.length - 1];
          
          let startCol = minObserved;
          if (PASILLO_CONFIG_OVERRIDES[pas] && PASILLO_CONFIG_OVERRIDES[pas].start !== undefined) {
            startCol = Math.min(PASILLO_CONFIG_OVERRIDES[pas].start, minObserved);
          }

          pasilloColumnsMap[pas] = Array.from({length: (maxCol - startCol + 1)}, (_, i) => i + startCol);
        });

        Object.keys(selColSets).forEach(pas => {
          const sortedCols = Array.from(selColSets[pas]).sort((a, b) => a - b);
          const maxColObserved = sortedCols[sortedCols.length - 1];
          
          if (PASILLO_CONFIG_OVERRIDES[pas]) {
            const cfg = PASILLO_CONFIG_OVERRIDES[pas];
            const finalStart = cfg.start !== undefined ? cfg.start : sortedCols[0];
            const finalEnd = cfg.end !== undefined ? Math.max(cfg.end, maxColObserved) : maxColObserved;
            pasilloSelectivoColumnsMap[pas] = Array.from({length: (finalEnd - finalStart + 1)}, (_, i) => i + finalStart);
          } else {
            const minCol = sortedCols[0];
            pasilloSelectivoColumnsMap[pas] = Array.from({length: (maxColObserved - minCol + 1)}, (_, i) => i + minCol);
          }
        });

        document.getElementById('lblTotalPallets').innerText = totalPallets.toLocaleString('es-AR');
        document.getElementById('lblTotalUnidades').innerText = totalUnidadesSum.toLocaleString('es-AR') + ' u.';
        document.getElementById('lblTotalVolumen').innerText = globalTotalVolumenM3.toFixed(1) + ' m³';
        document.getElementById('lblRubros').innerText = allRubros.size;
        document.getElementById('lblUbicacionesTotales').innerHTML = `${activePasillosPenetrable.length + activePasillosSelectivo.length + activeBloques.length + activeStagingDocks.length} <span class="text-xs font-normal text-slate-500">(Zonas)</span>`;

        renderLegend();

        let totalCapacityGlobal = 0;
        activePasillosPenetrable.forEach(pas => {
          const colsCount = (pasilloColumnsMap[pas] || []).length;
          totalCapacityGlobal += colsCount * MAX_CAPACITY;
        });

        const oc = totalCapacityGlobal > 0 ? Math.min(100, Math.round((totalPallets / totalCapacityGlobal) * 100)) : 0;
        document.getElementById('lblOcupacion').innerText = oc + '%';

        renderMap();

      } catch (err) {
        alert('Hubo un error al procesar el archivo. Comprobá el formato del Excel.');
        console.error(err);
      }
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * ============================================================================
 * MÓDULO DE MODO EXPOSICIÓN DINÁMICO E INTERMITENTE
 * ============================================================================
 */

let screensaverInterval = null;
let screensaverCountdown = null;
let currentScreensaverSeconds = 7;

function toggleScreensaverManual() {
  showScreensaver();
}

function showScreensaver() {
  if (rawInventoryData.length === 0) {
    alert('Cargá un informe de stock primero para activar el Modo Exposición.');
    return;
  }

  const overlay = document.getElementById('screensaverOverlay');
  if (!overlay) return;

  overlay.classList.remove('hidden');
  renderRandomExpositionSlide();

  clearInterval(screensaverInterval);
  clearInterval(screensaverCountdown);

  currentScreensaverSeconds = 7;
  updateScreensaverTimerLabel();

  screensaverCountdown = setInterval(() => {
    currentScreensaverSeconds--;
    if (currentScreensaverSeconds <= 0) {
      currentScreensaverSeconds = 7;
    }
    updateScreensaverTimerLabel();
  }, 1000);

  screensaverInterval = setInterval(() => {
    renderRandomExpositionSlide();
  }, 7000);
}

function updateScreensaverTimerLabel() {
  const lbl = document.getElementById('screensaverTimerLabel');
  if (lbl) lbl.innerText = `Siguiente presentación en ${currentScreensaverSeconds}s`;
}

function hideScreensaver() {
  const overlay = document.getElementById('screensaverOverlay');
  if (overlay) overlay.classList.add('hidden');

  clearInterval(screensaverInterval);
  clearInterval(screensaverCountdown);
}
modal
function renderRandomExpositionSlide() {
  const container = document.getElementById('screensaverCardContainer');
  if (!container || rawInventoryData.length === 0) return;

  // Añadimos 'FLOW_IN_OUT' al array de tipos de diapositivas aleatorias
  const slideTypes = ['RUBRO', 'BLOQUE', 'PENETRABLE', 'SELECTIVO_VISUAL', 'PENETRABLE_VISUAL', 'FLOW_IN_OUT', 'STAGE', 'SKU_HIGHLIGHT'];
  const chosenType = slideTypes[Math.floor(Math.random() * slideTypes.length)];

  if (chosenType === 'RUBRO') {
    const rubrosArray = Array.from(allRubros);
    if (rubrosArray.length === 0) return renderRandomExpositionSlide();

    const selectedRubros = [...rubrosArray].sort(() => 0.5 - Math.random()).slice(0, 2);
    const mainRubro = selectedRubros[0];
    const styleObj = getRubroColorHex(mainRubro);

    let rubroItems = rawInventoryData.filter(r => (r['Rubro'] || r['RUBRO'] || '').toString().toUpperCase() === mainRubro.toUpperCase());
    const totalUnits = rubroItems.reduce((acc, r) => acc + parseInt(r['Cantidad'] || r['CANTIDAD'] || 1), 0);
    const totalPallets = new Set(rubroItems.map(r => r['Pallet'] || r['ID Pallet']).filter(Boolean)).size;

    let totalVol = 0;
    rubroItems.forEach(r => {
      let v = parseFloat(r['Volumen Total'] || r['Volumen'] || 0);
      if (v <= 50) totalVol += v;
    });

    const samples = [...rubroItems].sort(() => 0.5 - Math.random()).slice(0, 3);
    let sampleHtml = '';
    samples.forEach(it => {
      const sku = it['Producto código'] || it['SKU'] || 'N/A';
      const desc = it['Productos nombre'] || it['Descripcion'] || 'Descripción no disponible';
      const cant = it['Cantidad'] || '1';
      const p = (it['Pasillo'] || '').toString().toUpperCase();
      const r = (it['Rack'] || '').toString();

      sampleHtml += `
        <div class="bg-white text-slate-900 p-3 rounded-xl shadow-sm border border-emerald-300 flex justify-between items-center">
          <div>
            <span class="text-[10px] font-black uppercase text-purple-700 tracking-wider">SKU: ${sku}</span>
            <h4 class="text-xs font-black text-slate-900 truncate max-w-xl">${desc}</h4>
            <span class="text-[11px] font-bold text-slate-700"><i class="fa-solid fa-location-dot text-purple-600 mr-1"></i> Ubicación: ${p} ${r}</span>
          </div>
          <div class="text-right">
            <span class="text-xl font-black text-emerald-700 font-mono">${cant}</span>
            <span class="text-[9px] font-bold text-slate-600 block">unidades</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="p-6 rounded-3xl shadow-2xl space-y-4 relative overflow-hidden animate-fade-card border-4 border-purple-600 bg-white text-slate-900 max-w-6xl mx-auto w-full">
        <div class="flex justify-between items-center border-b-2 border-emerald-500 pb-3">
          <div class="flex items-center space-x-3">
            <span class="w-4 h-4 rounded-full shadow" style="background-color: ${styleObj.bg};"></span>
            <span class="text-xs font-black uppercase tracking-widest text-purple-700">FOCO EN CATEGORÍA</span>
          </div>
          <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-white shadow-md bg-purple-600">
            RUBRO: ${mainRubro}
          </span>
        </div>

        <div class="flex justify-between items-baseline">
          <div>
            <h3 class="text-4xl lg:text-5xl font-black text-slate-950 tracking-tight uppercase">${mainRubro}</h3>
            <p class="text-xs text-slate-700 font-bold mt-0.5">Análisis de volumen y stock en tiempo real</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-500 text-center shadow-sm">
            <span class="text-[10px] font-black uppercase text-emerald-900 tracking-wider">UNIDADES EN DEPÓSITO</span>
            <div class="text-3xl font-black text-emerald-700 font-mono mt-1">${totalUnits.toLocaleString('es-AR')} u.</div>
          </div>
          <div class="bg-purple-50 p-4 rounded-2xl border-2 border-purple-500 text-center shadow-sm">
            <span class="text-[10px] font-black uppercase text-purple-900 tracking-wider">PALLETS REGISTRADOS</span>
            <div class="text-3xl font-black text-purple-700 font-mono mt-1">${totalPallets} plt.</div>
          </div>
          <div class="bg-amber-50 p-4 rounded-2xl border-2 border-amber-500 text-center shadow-sm">
            <span class="text-[10px] font-black uppercase text-amber-900 tracking-wider">OCUPACIÓN VOLUMÉTRICA</span>
            <div class="text-3xl font-black text-slate-900 font-mono mt-1">${totalVol.toFixed(1)} m³</div>
          </div>
        </div>

        <div class="space-y-2 pt-1">
          <span class="text-xs font-black uppercase tracking-widest text-emerald-800 block"><i class="fa-solid fa-star mr-1 text-purple-600"></i> Muestra Aleatoria del Rubro</span>
          <div class="grid grid-cols-1 gap-2">${sampleHtml}</div>
        </div>
      </div>
    `;

  } else if (chosenType === 'FLOW_IN_OUT') {
    // Cálculo de métricas para STAGE IN y STAGE OUT
    let itemsIn = rawInventoryData.filter(r => {
      const u = (r['Ubicacion'] || r['UBICACION'] || r['Pasillo'] || '').toString().toUpperCase();
      return u.includes('IN') || u.includes('RECEPCION') || u.includes('REC');
    });
    
    let itemsOut = rawInventoryData.filter(r => {
      const u = (r['Ubicacion'] || r['UBICACION'] || r['Pasillo'] || '').toString().toUpperCase();
      return u.includes('OUT') || u.includes('DESPACHO') || u.includes('EXP');
    });

    const totalPalletsIn = new Set(itemsIn.map(r => r['Pallet'] || r['ID Pallet']).filter(Boolean)).size || Math.round(itemsIn.length / 2);
    const totalUnitsIn = itemsIn.reduce((acc, r) => acc + parseInt(r['Cantidad'] || r['CANTIDAD'] || 1), 0);
    
    const totalPalletsOut = new Set(itemsOut.map(r => r['Pallet'] || r['ID Pallet']).filter(Boolean)).size || Math.round(itemsOut.length / 2);
    const totalUnitsOut = itemsOut.reduce((acc, r) => acc + parseInt(r['Cantidad'] || r['CANTIDAD'] || 1), 0);

    container.innerHTML = `
      <div class="p-8 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden animate-fade-card border-4 border-amber-500 bg-white text-slate-900 max-w-6xl mx-auto w-full">
        <div class="flex justify-between items-center border-b-2 border-amber-400 pb-4">
          <div class="flex items-center space-x-3">
            <span class="w-4 h-4 rounded-full bg-amber-500 shadow"></span>
            <span class="text-xs font-black uppercase tracking-widest text-amber-700">MONITOREO DE FLUJO OPERATIVO</span>
          </div>
          <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-slate-900 text-white shadow-md">
            STAGE IN / STAGE OUT
          </span>
        </div>

        <div>
          <h3 class="text-4xl font-black text-slate-950 tracking-tight">CONTROL DE ANDENES Y STAGES</h3>
          <p class="text-xs text-slate-600 font-bold mt-1">Estado actual del flujo de recepción y despacho de mercadería</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Tarjeta Stage IN -->
          <div class="bg-amber-50 p-6 rounded-2xl border-2 border-amber-400 shadow-md space-y-4">
            <div class="flex items-center justify-between border-b border-amber-200 pb-3">
              <span class="text-sm font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
                <i class="fa-solid fa-circle-down text-amber-600 text-lg"></i> STAGE IN (RECEPCIÓN)
              </span>
              <span class="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-white shadow">INGRESO</span>
            </div>
            <div class="grid grid-cols-2 gap-4 text-center">
              <div class="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                <span class="text-[10px] font-black uppercase text-slate-500 block">PALLETS EN STAGE</span>
                <span class="text-3xl font-black text-amber-700 font-mono">${totalPalletsIn} plt.</span>
              </div>
              <div class="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                <span class="text-[10px] font-black uppercase text-slate-500 block">UNIDADES TOTALES</span>
                <span class="text-3xl font-black text-slate-900 font-mono">${totalUnitsIn.toLocaleString('es-AR')} u.</span>
              </div>
            </div>
          </div>

          <!-- Tarjeta Stage OUT -->
          <div class="bg-blue-50 p-6 rounded-2xl border-2 border-blue-400 shadow-md space-y-4">
            <div class="flex items-center justify-between border-b border-blue-200 pb-3">
              <span class="text-sm font-black uppercase tracking-wider text-blue-900 flex items-center gap-2">
                <i class="fa-solid fa-truck-fast text-blue-600 text-lg"></i> STAGE OUT (DESPACHO)
              </span>
              <span class="px-3 py-1 rounded-full text-xs font-black bg-blue-600 text-white shadow">SALIDA</span>
            </div>
            <div class="grid grid-cols-2 gap-4 text-center">
              <div class="bg-white p-4 rounded-xl border border-blue-200 shadow-sm">
                <span class="text-[10px] font-black uppercase text-slate-500 block">PALLETS EN STAGE</span>
                <span class="text-3xl font-black text-blue-700 font-mono">${totalPalletsOut} plt.</span>
              </div>
              <div class="bg-white p-4 rounded-xl border border-blue-200 shadow-sm">
                <span class="text-[10px] font-black uppercase text-slate-500 block">UNIDADES TOTALES</span>
                <span class="text-3xl font-black text-slate-900 font-mono">${totalUnitsOut.toLocaleString('es-AR')} u.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

  } else if (chosenType === 'SELECTIVO_VISUAL') {
    if (activePasillosSelectivo.length === 0) return renderRandomExpositionSlide();
    const randomPasillo = activePasillosSelectivo[Math.floor(Math.random() * activePasillosSelectivo.length)];
    const cols = pasilloSelectivoColumnsMap[randomPasillo] || [];
    const maxLvl = pasilloSelectivoMaxLevelMap[randomPasillo] || 5;

    let gridHtml = '';
    const limitedCols = cols.slice(0, 16);

    let niveles = [];
    for (let niv = maxLvl; niv >= 1; niv--) {
      niveles.push(niv);
    }

    niveles.forEach(niv => {
      gridHtml += `<div class="flex items-center gap-1 mb-1 justify-center"><span class="w-16 text-[10px] font-black text-slate-600 text-right pr-2">ESTANTE ${niv}</span>`;
      limitedCols.forEach(c => {
        const key = `${randomPasillo}-${c}-${niv}`;
        const data = selectivoTotals[key];
        let boxStyle = 'background-color: #f1f5f9; color: #cbd5e1;';
        let displayText = '·';
        if (data && data.items.length > 0) {
          const singleRubro = Array.from(data.rubrosSet)[0];
          const styleObj = getRubroColorHex(singleRubro);
          boxStyle = `background-color: ${styleObj.bg}; color: ${styleObj.text};`;
          displayText = getRubroShortName(singleRubro).substring(0, 3);
        }
        gridHtml += `<div title="Estante ${niv} - Col ${c}" class="h-8 flex-1 rounded text-[9px] font-black flex items-center justify-center shadow-sm truncate px-0.5" style="${boxStyle}">${displayText}</div>`;
      });
      gridHtml += `</div>`;
    });

    let headerColsHtml = `<div class="flex items-center gap-1 mb-1.5 justify-center"><span class="w-16"></span>`;
    limitedCols.forEach(c => {
      headerColsHtml += `<div class="flex-1 text-center text-[10px] font-black text-slate-700">${c}</div>`;
    });
    headerColsHtml += `</div>`;

    container.innerHTML = `
      <div class="p-6 rounded-3xl shadow-2xl space-y-3 relative overflow-hidden animate-fade-card border-4 border-purple-600 bg-white text-slate-900 max-w-6xl mx-auto w-full">
        <div class="flex justify-between items-center border-b-2 border-emerald-500 pb-2.5">
          <div class="flex items-center space-x-3">
            <span class="w-4 h-4 rounded-full bg-purple-600 shadow"></span>
            <span class="text-xs font-black uppercase tracking-widest text-purple-700">MAPA VISUAL DE UBICACIONES</span>
          </div>
          <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-purple-600 text-white shadow-md">
            RACK SELECTIVO ${randomPasillo}
          </span>
        </div>
        <div>
          <h3 class="text-3xl font-black text-slate-950 tracking-tight">VISTA DE ESTANTERÍA SELECTIVA — ${randomPasillo}</h3>
          <p class="text-xs text-slate-600 font-bold">Estado visual por niveles y módulos en tiempo real</p>
        </div>
        <div class="bg-slate-50 p-3 rounded-2xl border-2 border-slate-200 shadow-inner overflow-x-auto">
          ${headerColsHtml}
          ${gridHtml}
        </div>
      </div>
    `;

  } else if (chosenType === 'PENETRABLE_VISUAL') {
    if (activePasillosPenetrable.length === 0) return renderRandomExpositionSlide();
    const randomPasillo = activePasillosPenetrable[Math.floor(Math.random() * activePasillosPenetrable.length)];
    const cols = (pasilloColumnsMap[randomPasillo] || []).slice(0, 24);

    let totalModulos = cols.length;
    let modulosVacios = 0;
    let modulosCompletos = 0;
    let rubrosEnPasillo = new Set();
    let totalPalletsPasillo = 0;

    let barsHtml = '';
    cols.forEach(c => {
      const rackKey = `${randomPasillo}-${c}`;
      const data = rackTotals[rackKey];
      const total = data ? data.total : 0;
      const percent = Math.min(100, Math.round((total / MAX_CAPACITY) * 100));
      
      if (total === 0) modulosVacios++;
      if (percent >= 100) modulosCompletos++;
      if (data && data.rubro) rubrosEnPasillo.add(data.rubro.toUpperCase());
      totalPalletsPasillo += total;

      let barColor = data ? getRubroColorHex(data.rubro).bg : '#e2e8f0';
      if (total > MAX_CAPACITY) barColor = '#b91c1c';

      barsHtml += `
        <div class="flex flex-col items-center flex-1">
          <span class="text-[9px] font-black text-slate-700 mb-1">${percent}%</span>
          <div class="w-full h-24 bg-slate-100 rounded-lg border border-slate-200 relative overflow-hidden flex flex-col justify-end shadow-inner">
            <div class="w-full transition-all duration-500" style="height: ${percent}%; background-color: ${total > 0 ? barColor : 'transparent'};"></div>
          </div>
          <span class="text-[9px] font-black text-slate-600 mt-1">${c}</span>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="p-6 rounded-3xl shadow-2xl space-y-3 relative overflow-hidden animate-fade-card border-4 border-purple-600 bg-white text-slate-900 max-w-6xl mx-auto w-full">
        <div class="flex justify-between items-center border-b-2 border-emerald-500 pb-2.5">
          <div class="flex items-center space-x-3">
            <span class="w-4 h-4 rounded-full bg-blue-600 shadow"></span>
            <span class="text-xs font-black uppercase tracking-widest text-blue-700">MAPA VISUAL DE OCUPACIÓN</span>
          </div>
          <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-blue-600 text-white shadow-md">
            PASILLO PENETRABLE ${randomPasillo}
          </span>
        </div>

        <div class="flex justify-between items-baseline">
          <div>
            <h3 class="text-3xl font-black text-slate-950 tracking-tight">OCUPACIÓN EN PENETRABLES — ${randomPasillo}</h3>
            <p class="text-xs text-slate-600 font-bold">Porcentaje de ocupación por cada módulo de estiba</p>
          </div>
        </div>

        <div class="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 shadow-inner flex items-end gap-1 h-40">
          ${barsHtml}
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 pt-0.5">
          <div class="bg-purple-50 p-3 rounded-xl border border-purple-300 text-center shadow-sm">
            <span class="text-[10px] font-black uppercase text-purple-900 tracking-wider block">MÓDULOS VACÍOS</span>
            <span class="text-xl font-black text-purple-700 font-mono">${modulosVacios} / ${totalModulos}</span>
          </div>
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-300 text-center shadow-sm">
            <span class="text-[10px] font-black uppercase text-emerald-900 tracking-wider block">TOTAL PALLETS</span>
            <span class="text-xl font-black text-emerald-700 font-mono">${totalPalletsPasillo} plt.</span>
          </div>
          <div class="bg-amber-50 p-3 rounded-xl border border-amber-300 text-center shadow-sm">
            <span class="text-[10px] font-black uppercase text-amber-900 tracking-wider block">RUBROS ACTIVOS</span>
            <span class="text-xl font-black text-slate-900 font-mono">${rubrosEnPasillo.size} Rubros</span>
          </div>
          <div class="bg-blue-50 p-3 rounded-xl border border-blue-300 text-center shadow-sm">
            <span class="text-[10px] font-black uppercase text-blue-900 tracking-wider block">MÓDULOS AL 100%</span>
            <span class="text-xl font-black text-blue-700 font-mono">${modulosCompletos} Módulos</span>
          </div>
        </div>
      </div>
    `;

  } else if (chosenType === 'BLOQUE') {
    if (activeBloques.length === 0) return renderRandomExpositionSlide();

    const randomZone = activeBloques[Math.floor(Math.random() * activeBloques.length)];
    const data = bloqueTotals[randomZone];
    if (!data) return renderRandomExpositionSlide();

    const totalPallets = data.palletsItems.length;
    const totalUnits = data.totalUnidadesSum;
    const totalVol = data.volumenTotal || 0;

    container.innerHTML = `
      <div class="p-6 rounded-3xl shadow-2xl space-y-4 relative overflow-hidden animate-fade-card border-4 border-purple-600 bg-white text-slate-900 max-w-6xl mx-auto w-full">
        <div class="flex justify-between items-center border-b-2 border-purple-500 pb-3">
          <div class="flex items-center space-x-3">
            <span class="w-4 h-4 rounded-full bg-emerald-600 shadow"></span>
            <span class="text-xs font-black uppercase tracking-widest text-emerald-800">ESTIBA EN PISO / BLOQUE</span>
          </div>
          <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-purple-600 text-white shadow-md">
            ZONA: ${randomZone}
          </span>
        </div>

        <div>
          <h3 class="text-4xl lg:text-5xl font-black text-slate-950 tracking-tight">PISO / BLOQUE: ${randomZone}</h3>
          <p class="text-xs text-slate-700 font-bold mt-0.5">Monitoreo de almacenamiento directo en piso</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-purple-50 p-4 rounded-2xl border-2 border-purple-500 text-center shadow-sm">
            <span class="text-xs font-black uppercase text-purple-900 tracking-wider">PALLETS CON ID</span>
            <div class="text-3xl font-black text-purple-700 font-mono mt-1">${totalPallets} plt.</div>
          </div>
          <div class="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-500 text-center shadow-sm">
            <span class="text-xs font-black uppercase text-emerald-900 tracking-wider">UNIDADES FRACCIONADAS</span>
            <div class="text-3xl font-black text-emerald-700 font-mono mt-1">${totalUnits.toLocaleString('es-AR')} u.</div>
          </div>
          <div class="bg-amber-50 p-4 rounded-2xl border-2 border-amber-500 text-center shadow-sm">
            <span class="text-xs font-black uppercase text-amber-900 tracking-wider">VOLUMEN m³</span>
            <div class="text-3xl font-black text-slate-900 font-mono mt-1">${totalVol.toFixed(1)} m³</div>
          </div>
        </div>
      </div>
    `;

  } else if (chosenType === 'PENETRABLE') {
    if (activePasillosPenetrable.length === 0) return renderRandomExpositionSlide();

    const randomPasillo = activePasillosPenetrable[Math.floor(Math.random() * activePasillosPenetrable.length)];
    const cols = pasilloColumnsMap[randomPasillo] || [];

    let totalPallets = 0;
    cols.forEach(c => {
      const data = rackTotals[`${randomPasillo}-${c}`];
      if (data) totalPallets += data.total;
    });

    const maxCap = cols.length * MAX_CAPACITY;
    const pct = maxCap > 0 ? Math.min(100, Math.round((totalPallets / maxCap) * 100)) : 0;

    container.innerHTML = `
      <div class="p-6 rounded-3xl shadow-2xl space-y-4 relative overflow-hidden animate-fade-card border-4 border-purple-600 bg-white text-slate-900 max-w-6xl mx-auto w-full">
        <div class="flex justify-between items-center border-b-2 border-emerald-500 pb-3">
          <div class="flex items-center space-x-3">
            <span class="w-4 h-4 rounded-full bg-purple-600 shadow"></span>
            <span class="text-xs font-black uppercase tracking-widest text-purple-700">PASILLO PENETRABLE</span>
          </div>
          <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-600 text-white shadow-md">
            PASILLO: ${randomPasillo}
          </span>
        </div>

        <div class="flex justify-between items-baseline">
          <div>
            <h3 class="text-4xl lg:text-5xl font-black text-slate-950 tracking-tight">RACK PENETRABLE ${randomPasillo}</h3>
            <p class="text-xs text-slate-700 font-bold mt-0.5">Ocupación por profundidad en túneles de estiba</p>
          </div>
          <div class="text-right">
            <span class="text-5xl font-black text-purple-600 font-mono">${pct}%</span>
            <span class="text-xs text-slate-600 font-bold block uppercase">Capacidad Utilizada</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-purple-50 p-4 rounded-2xl border-2 border-purple-500 text-center shadow-sm">
            <span class="text-xs font-black uppercase text-purple-900 tracking-wider block">PALLETS EN PASILLO</span>
            <span class="text-4xl font-black text-purple-700 font-mono">${totalPallets} / ${maxCap}</span>
          </div>
          <div class="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-500 text-center shadow-sm">
            <span class="text-xs font-black uppercase text-emerald-900 tracking-wider block">CANTIDAD DE RACKS/MÓDULOS</span>
            <span class="text-4xl font-black text-emerald-700 font-mono">${cols.length} Módulos</span>
          </div>
        </div>
      </div>
    `;

  } else {
    const validRows = rawInventoryData.filter(r => (r['Producto código'] || r['SKU'] || '').toString().trim() !== '');
    if (validRows.length === 0) return renderRandomExpositionSlide();

    const randomItem = validRows[Math.floor(Math.random() * validRows.length)];

    const sku = randomItem['Producto código'] || randomItem['SKU'] || 'S/N';
    const desc = randomItem['Productos nombre'] || randomItem['Descripcion'] || 'Producto sin descripción';
    const cant = randomItem['Cantidad'] || '1';
    const rubro = (randomItem['Rubro'] || 'OTROS').toString().toUpperCase();
    const p = (randomItem['Pasillo'] || '').toString().toUpperCase();
    const r = (randomItem['Rack'] || '').toString();
    const est = (randomItem['Estante'] !== undefined ? randomItem['Estante'] : (randomItem['Nivel'] !== undefined ? randomItem['Nivel'] : '')).toString();

    let ubiText = `${p} ${r}`.trim();
    if (est) ubiText += ` - Estante ${est}`;

    container.innerHTML = `
      <div class="p-6 rounded-3xl shadow-2xl space-y-4 relative overflow-hidden animate-fade-card border-4 border-purple-600 bg-white text-slate-900 max-w-6xl mx-auto w-full">
        <div class="flex justify-between items-center border-b-2 border-emerald-500 pb-3">
          <div class="flex items-center space-x-3">
            <span class="w-4 h-4 rounded-full bg-purple-600 shadow"></span>
            <span class="text-xs font-black uppercase tracking-widest text-slate-700">FICHA DESTACADA DE PRODUCTO</span>
          </div>
          <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-white shadow-md bg-emerald-600">
            ${rubro}
          </span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
          <div class="lg:col-span-2 space-y-2">
            <span class="text-xs font-black text-purple-600 uppercase tracking-widest block">CÓDIGO SKU DESTACADO</span>
            <h3 class="text-4xl lg:text-5xl font-black text-slate-950 font-mono tracking-tight">${sku}</h3>
            <p class="text-base text-slate-800 font-semibold line-clamp-2">${desc}</p>
          </div>

          <div class="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-500 text-center space-y-1 shadow-sm">
            <span class="text-xs font-black uppercase text-emerald-900 tracking-wider">STOCK EN UBICACIÓN</span>
            <div class="text-5xl font-black text-emerald-700 font-mono">${cant} <span class="text-lg font-bold text-slate-600">u.</span></div>
          </div>
        </div>

        <div class="bg-purple-50 border-2 border-purple-500 text-slate-900 p-4 rounded-2xl flex justify-between items-center shadow-sm">
          <div>
            <span class="text-xs font-black text-purple-900 uppercase tracking-wider block">UBICACIÓN FÍSICA EXACTA</span>
            <span class="text-2xl font-black text-slate-950 font-mono tracking-wider">${ubiText || 'Depósito Central'}</span>
          </div>
          <div class="p-3 bg-purple-600 text-white rounded-xl text-2xl font-bold shadow">
            <i class="fa-solid fa-location-dot"></i>
          </div>
        </div>
      </div>
    `;
  }
}

renderLegend();