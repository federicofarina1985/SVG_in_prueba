/**
 * ============================================================================
 * MOTOR DE IMPRESIÓN DE ETIQUETAS (LabelEngine) - Versión Definitiva
 * ============================================================================
 */
const LabelEngine = (() => {

  function injectPrintStyles(isMasive) {
    let styleEl = document.getElementById('dynamicPrintStyle');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamicPrintStyle';
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      @media print {
        html, body {
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: hidden !important;
        }
        body * { 
          visibility: hidden !important; 
        }
        #printArea, #printArea * { 
          visibility: visible !important; 
        }
        #printArea { 
          position: absolute !important; 
          left: 0 !important; 
          top: 0 !important; 
          width: 100% !important; 
          height: 100% !important;
          display: block !important;
          margin: 0 !important; 
          padding: 0 !important; 
          background: #ffffff !important;
        }
        .single-label-page {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .masive-label-page {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        .masive-label-page:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        @page { 
          size: landscape; 
          margin: 0; 
        }
      }
    `;
  }

  function renderCardHtml(isSkuPrimary, mainId, name, calidad, rubro, ubicacionTextoCompleta, displaySku = null, svgClass = 'barcodeSvgTarget') {
    let rubroColor = '#2563eb';
    const r = (rubro || '').toString().toUpperCase();
    if (r.includes('REPU')) rubroColor = '#2563eb';
    else if (r.includes('INFORM')) rubroColor = '#475569';
    else if (r.includes('LINEA BLANCA')) rubroColor = '#059669';
    else if (r.includes('TELEVI')) rubroColor = '#d97706';
    else if (r.includes('PEQUE')) rubroColor = '#db2777';
    else if (r.includes('CENTRAL') || r.includes('AIRE')) rubroColor = '#0284c7';
    else if (r.includes('COCC')) rubroColor = '#7c3aed';
    else if (r.includes('CALEF')) rubroColor = '#ea580c';

    const finalNameText = displaySku ? `${name} <span style="font-weight: 700; color: #475569; font-size: 3.5vh;">(SKU: ${displaySku})</span>` : name;
    const headerTitleLabel = isSkuPrimary ? 'CÓDIGO SKU' : 'N° PALLET / ID';

    return `
      <div style="
        width: 100%; height: 100%; box-sizing: border-box; padding: 4% 5%; 
        background-color: #ffffff; font-family: ui-sans-serif, system-ui, sans-serif;
        display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; border: none;
      ">
        <div style="position: absolute; top: 0; left: 0; width: 3.5%; height: 100%; background-color: ${rubroColor};"></div>
        <div style="padding-left: 3%; display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000000; padding-bottom: 1.5vh;">
            <div>
              <span style="font-size: 3.2vh; font-weight: 900; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">
                ${headerTitleLabel}
              </span>
              <h4 style="font-size: 8vh; font-weight: 900; color: #000000; margin: 0.2vh 0 0 0; line-height: 1.1;">
                ${mainId}
              </h4>
            </div>
            <div>
              <span style="padding: 1.2vh 3vw; border-radius: 9999px; font-size: 3.2vh; font-weight: 900; text-transform: uppercase; background-color: #ffffff; color: #000000; border: 2px solid #000000;">
                ${calidad}
              </span>
            </div>
          </div>
          <div style="text-align: center; padding: 1vh 0; display: flex; justify-content: center; align-items: center; border-bottom: 2px solid #000000;">
            <svg class="${svgClass}" style="width: 88%; max-height: 25vh;"></svg>
          </div>
          <div style="padding-top: 1vh; display: flex; flex-direction: column; gap: 0.8vh;">
            <div style="font-size: 3.8vh; font-weight: 700; color: #475569;">
              Rubro: <strong style="color: ${rubroColor}; font-weight: 900;">${rubro}</strong>
            </div>
            <p style="font-size: 4.2vh; color: #000000; font-weight: 800; margin: 0; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${finalNameText}
            </p>
          </div>
          <div style="border-top: 2px solid #000000; padding-top: 1.2vh; display: flex; justify-content: flex-end; align-items: center;">
            <span style="color: #000000; font-weight: 900; font-size: 4vh; text-transform: uppercase;">Ubicación: ${ubicacionTextoCompleta}</span>
          </div>
        </div>
      </div>
    `;
  }

  function printSingleLabel(pasillo, col, pallet, sku, name, cant, index, total, rubro, calidad) {
    const printArea = document.getElementById('printArea');
    if (!printArea) return;
    
    injectPrintStyles(false);
    printArea.innerHTML = '';

    const ubiTexto = (col && col !== '-') ? `${pasillo} ${col}` : `${pasillo}`;
    const cleanPallet = (pallet && pallet.toString().trim() !== '' && pallet.toString().trim().toUpperCase() !== 'S/N') ? pallet.toString().trim() : '';
    
    const isSkuPrimary = cleanPallet === '';
    const mainId = isSkuPrimary ? (sku || 'N/A') : cleanPallet;
    const displaySku = isSkuPrimary ? null : sku;

    printArea.innerHTML = `
      <div class="single-label-page">
        ${renderCardHtml(isSkuPrimary, mainId, name, (calidad || 'DISPONIBLE').toUpperCase(), (rubro || 'OTROS').toUpperCase(), ubiTexto, displaySku, 'singleBarcodeSvg')}
      </div>
    `;

    setTimeout(() => {
      try {
        const svgEl = printArea.querySelector('.singleBarcodeSvg');
        if (svgEl) {
          JsBarcode(svgEl, mainId || "UNKNOWN", {
            format: "CODE128",
            lineColor: "#000000",
            width: 3.2,
            height: 70,
            displayValue: true,
            fontSize: 20,
            fontOptions: "bold",
            margin: 0
          });
        }
      } catch (e) {
        console.error("Error barcode single", e);
      }
      window.print();
    }, 200);
  }

  function printSingleItemLabel(pasillo, col, sku, name, cant, index, total, estanteInfo, rubro, calidad) {
    const printArea = document.getElementById('printArea');
    if (!printArea) return;

    injectPrintStyles(false);
    printArea.innerHTML = '';

    const ubiTexto = (col && col !== '-') ? `${pasillo} ${col} - ${estanteInfo}` : `${pasillo} - ${estanteInfo}`;

    printArea.innerHTML = `
      <div class="single-label-page">
        ${renderCardHtml(true, sku, name, (calidad || 'DISPONIBLE').toUpperCase(), (rubro || 'OTROS').toUpperCase(), ubiTexto, null, 'singleBarcodeSvg')}
      </div>
    `;

    setTimeout(() => {
      try {
        const svgEl = printArea.querySelector('.singleBarcodeSvg');
        if (svgEl) {
          JsBarcode(svgEl, sku || "UNKNOWN", {
            format: "CODE128",
            lineColor: "#000000",
            width: 3.2,
            height: 70,
            displayValue: true,
            fontSize: 20,
            fontOptions: "bold",
            margin: 0
          });
        }
      } catch (e) {
        console.error("Error barcode selectivo single", e);
      }
      window.print();
    }, 200);
  }

  function printAllCurrentRack() {
    const printArea = document.getElementById('printArea');
    if (!printArea) return;

    injectPrintStyles(true);
    printArea.innerHTML = '';

    let itemsToPrint = [];
    let mode = 'penetrable';
    let data = null;

    const currentTab = (typeof activeTab !== 'undefined') ? activeTab : '';
    
    let possibleKeys = [
      currentOpenRackKey,
      currentOpenRackKey ? currentOpenRackKey.replace(/-undefined$/, '') : null,
      currentOpenRackKey ? currentOpenRackKey.split('-')[0] : null
    ].filter(Boolean);

    if (currentTab === 'SELECTIVO' && typeof selectivoTotals !== 'undefined') {
      for (let k of possibleKeys) {
        if (selectivoTotals[k]) { data = selectivoTotals[k]; mode = 'selectivo'; break; }
      }
    } else if (currentTab === 'BLOQUE' && typeof bloqueTotals !== 'undefined') {
      for (let k of possibleKeys) {
        if (bloqueTotals[k]) { data = bloqueTotals[k]; mode = 'bloque'; break; }
      }
    }

    if (!data && typeof rackTotals !== 'undefined') {
      for (let k of possibleKeys) {
        if (rackTotals[k]) { data = rackTotals[k]; mode = 'penetrable'; break; }
      }
    }
    if (!data && typeof selectivoTotals !== 'undefined') {
      for (let k of possibleKeys) {
        if (selectivoTotals[k]) { data = selectivoTotals[k]; mode = 'selectivo'; break; }
      }
    }
    if (!data && typeof bloqueTotals !== 'undefined') {
      for (let k of possibleKeys) {
        if (bloqueTotals[k]) { data = bloqueTotals[k]; mode = 'bloque'; break; }
      }
    }

    if (data) {
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        itemsToPrint = data.items;
      } else if (data.palletsItems || data.unidadesItems) {
        itemsToPrint = [...(data.palletsItems || []), ...(data.unidadesItems || [])];
      }
    }

    if (itemsToPrint.length === 0 && typeof rawInventoryData !== 'undefined') {
      const titleText = document.getElementById('drawerTitle') ? document.getElementById('drawerTitle').innerText : '';
      itemsToPrint = rawInventoryData.filter(r => {
        const ubi = (r['Ubicación'] || r['UBICACION'] || '').toString();
        return titleText && ubi.includes(titleText.split(' - ')[0]);
      });
    }

    if (itemsToPrint.length === 0) {
      alert('No hay ítems para imprimir en esta ubicación.');
      return;
    }

    let htmlContent = '';
    let barcodeValues = [];

    itemsToPrint.forEach((item) => {
      const rawPallet = item['Pallet'] || item['ID Pallet'] || item['LPN'] || '';
      const cleanPallet = rawPallet ? rawPallet.toString().trim() : '';
      const hasValidPallet = cleanPallet !== '' && cleanPallet.toUpperCase() !== 'S/N';

      const prodCode = item['Producto código'] || item['PRODUCTO CODIGO'] || item['SKU'] || item.sku || 'N/A';
      const prodName = item['Productos nombre'] || item['PRODUCTOS NOMBRE'] || item['Descripcion'] || item.desc || 'Descripción no disponible';
      const calidad = (item['Calidad'] || item['CALIDAD'] || item.calidad || 'DISPONIBLE').toString().toUpperCase();
      const itemRubro = (item['Rubro'] || item['RUBRO'] || item.rubro || 'OTROS').toString().toUpperCase();
      
      let ubiTexto = '';
      if (mode === 'selectivo') {
        const parts = (currentOpenRackKey || '').split('-');
        ubiTexto = `${parts[0]} ${parts[1] || ''} - Estante ${parts[2] || '1'}`.trim();
      } else if (mode === 'bloque') {
        ubiTexto = `Zona: ${currentOpenRackKey || 'Bloque'}`;
      } else {
        ubiTexto = document.getElementById('drawerTitle') ? document.getElementById('drawerTitle').innerText : (currentOpenRackKey || 'Ubicación');
      }

      const isSelectivoItem = (mode === 'selectivo');
      const isSkuPrimary = isSelectivoItem || !hasValidPallet;
      
      const mainId = isSkuPrimary ? prodCode : cleanPallet;
      const displaySku = isSkuPrimary ? null : prodCode;

      barcodeValues.push(mainId);

      htmlContent += `
        <div class="masive-label-page">
          ${renderCardHtml(isSkuPrimary, mainId, prodName, calidad, itemRubro, ubiTexto, displaySku, 'masiveBarcodeSvg')}
        </div>
      `;
    });

    printArea.innerHTML = htmlContent;
    
    setTimeout(() => {
      try {
        const svgs = printArea.querySelectorAll('.masiveBarcodeSvg');
        svgs.forEach((svgEl, idx) => {
          const val = barcodeValues[idx];
          if (svgEl) {
            JsBarcode(svgEl, val || "UNKNOWN", {
              format: "CODE128",
              lineColor: "#000000",
              width: 3.2,
              height: 70,
              displayValue: true,
              fontSize: 20,
              fontOptions: "bold",
              margin: 0
            });
          }
        });
      } catch (e) {
        console.error("Error barcode masive", e);
      }
      window.print();
    }, 200);
  }

  function printSingleItemLabelFromInventory(sku, ubicacionFisica) {
    let matchedItem = null;
    if (typeof rawInventoryData !== 'undefined') {
      matchedItem = rawInventoryData.find(r => {
        const rSku = (r['Producto código'] || r['SKU'] || '').toString().trim();
        return rSku === sku;
      });
    }

    const desc = matchedItem ? (matchedItem['Productos nombre'] || matchedItem['Descripcion'] || 'Inventario General') : 'Inventario General';
    const rubro = matchedItem ? (matchedItem['Rubro'] || matchedItem['RUBRO'] || 'OTROS') : 'OTROS';
    const calidad = matchedItem ? (matchedItem['Calidad'] || matchedItem['CALIDAD'] || 'DISPONIBLE') : 'DISPONIBLE';

    printSingleItemLabel(ubicacionFisica, '', sku, desc, '', 1, 1, 'Inventario', rubro, calidad);
  }

  return {
    updatePrintConfig: () => injectPrintStyles(false),
    printSingleLabel,
    printSingleItemLabel,
    printSingleItemLabelFromInventory,
    printAllCurrentRack
  };
})();