(function () {
  "use strict";

  var STORAGE_KEY = "sqd-fire-control-v1";
  var state = loadState() || {
    mapId: "al-basrah", layer: "basemap", weaponId: "mortar-table-squ", gunElevation: 0,
    gun: { x: 0.33, y: 0.58, elevation: 0 },
    targets: [{ id: "A", x: 0.66, y: 0.34, elevation: 0 }], selectedTargetId: "A", mode: "gun", zoom: 1, panX: 0, panY: 0, image: null, imageUrl: null
  };
  var history = [];
  var els = {};
  var suppressNextMapClick = false;
  var touchClickUntil = 0;
  var mobileRevealTargetId = null;

  function $(id) { return document.getElementById(id); }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function saveState() {
    var saved = Object.assign({}, state, { image: null });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (e) { $("lastUpdate").textContent = "LOCAL SAVE FAILED"; }
  }
  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && ["AAS v1", "RAAS v2", "Invasion v1"].indexOf(saved.layer) >= 0) saved.layer = "basemap";
      if (saved) {
        saved.weaponId = MortarCalc.normalizeWeaponId(saved.weaponId || "mortar-table-squ");
        if (MortarCalc.findWeapon(saved.weaponId).id !== saved.weaponId) saved.weaponId = "mortar-table-squ";
      }
      return saved;
    } catch (e) { return null; }
  }
  function snapshot() { history.push(JSON.stringify(state)); if (history.length > 20) history.shift(); }
  function restoreSnapshot() { if (!history.length) return; state = JSON.parse(history.pop()); render(); }
  function currentMap() { return MortarCalc.findMap(state.mapId); }
  function currentWeapon() { return MortarCalc.findWeapon(state.weaponId); }
  function mapCode(name) { return name.split(/\s+/).map(function (v) { return v[0]; }).join("").slice(0, 3).toUpperCase(); }
  function formatDistance(m) { return m == null ? "—" : (m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m"); }
  function formatRadius(m) { return m == null ? "—" : m.toFixed(1) + " m"; }
  function pad2(v) { return String(v).padStart(2, "0"); }
  function titleCaseMap(name) { return name.toUpperCase(); }
  function node(tag, className, text) { var el = document.createElement(tag); if (className) el.className = className; if (text != null) el.textContent = text; return el; }
  function addMetric(parent, label, value) { var box = node("div"); box.appendChild(node("span", "metric-label", label)); box.appendChild(node("span", "metric-value", value)); parent.appendChild(box); }

  function init() {
    els.mapSelect = $("mapSelect"); els.layerSelect = $("layerSelect"); els.weaponSelect = $("weaponSelect");
    els.mapStage = $("mapStage"); els.mapImage = $("mapImage"); els.mapRaster = $("mapRaster"); els.gridOverlay = $("gridOverlay"); els.blastLayer = $("blastLayer"); els.rangeRing = $("rangeRing"); els.rangeBadge = $("rangeBadge"); els.markersLayer = $("markersLayer");
    els.solutionsList = $("solutionsList"); els.emptyState = $("emptyState"); els.mapFileInput = $("mapFileInput");
    els.mobileSolutionsList = $("mobileSolutionsList"); els.mobileSolutionsEmpty = $("mobileSolutionsEmpty");
    var groups = {};
    MortarCalc.maps.forEach(function (map) {
      var groupName = map.category === "official" ? "原版地图" : "模组：" + map.category;
      if (!groups[groupName]) { groups[groupName] = document.createElement("optgroup"); groups[groupName].label = groupName; els.mapSelect.appendChild(groups[groupName]); }
      var option = document.createElement("option"); option.value = map.id; option.textContent = map.name; groups[groupName].appendChild(option);
    });
    var weaponGroups = {};
    MortarCalc.weapons.forEach(function (weapon) {
      var groupName = weapon.group || "曲射武器";
      if (!weaponGroups[groupName]) { weaponGroups[groupName] = document.createElement("optgroup"); weaponGroups[groupName].label = groupName; els.weaponSelect.appendChild(weaponGroups[groupName]); }
      var option = document.createElement("option"); option.value = weapon.id; option.textContent = weapon.name + " · " + formatDistance(weapon.maxRange); weaponGroups[groupName].appendChild(option);
    });
    bindEvents(); render();
    window.addEventListener("resize", function () { resizeMapStage(effectiveMap()); renderGrid(effectiveMap()); applyZoom(); renderRange(); renderMarkers(); });
    window.addEventListener("load", function () { if (window.lucide) window.lucide.createIcons(); });
    if (window.lucide) window.lucide.createIcons();
  }

  function bindEvents() {
    document.querySelectorAll('.mobile-tabs button').forEach(function (button) {
      button.addEventListener('click', function () {
        document.body.dataset.mobilePanel = button.dataset.panel;
        document.querySelectorAll('.mobile-tabs button').forEach(function (tab) { tab.setAttribute('aria-pressed', String(tab === button)); });
        requestAnimationFrame(function () { resizeMapStage(effectiveMap()); renderGrid(effectiveMap()); applyZoom(); renderRange(); renderMarkers(); });
      });
    });
    bindTouchMap();
    els.mapSelect.addEventListener("change", function () { snapshot(); state.mapId = this.value; state.image = null; state.imageUrl = null; state.zoom = 1; state.panX = 0; state.panY = 0; render(); });
    els.layerSelect.addEventListener("change", function () { snapshot(); state.layer = this.value; render(); });
    els.weaponSelect.addEventListener("change", function () { snapshot(); state.weaponId = this.value; render(); });
    $("gunElevation").addEventListener("change", function () { state.gunElevation = Number(this.value) || 0; if (state.gun) state.gun.elevation = state.gunElevation; saveState(); renderSolutions(); });
    $("mapWidth").addEventListener("change", updateMapScale);
    $("mapHeight").addEventListener("change", updateMapScale);
    $("gunModeBtn").addEventListener("click", function () { setMode("gun"); });
    $("targetModeBtn").addEventListener("click", function () { setMode("target"); });
    $("undoBtn").addEventListener("click", restoreSnapshot);
    $("deleteBtn").addEventListener("click", deleteSelected);
    $("copySalvoBtn").addEventListener("click", copySalvo);
    $("mobileCopySalvoBtn").addEventListener("click", copySalvo);
    $("exportBtn").addEventListener("click", exportPlan);
    $("importPlanBtn").addEventListener("click", function () { $("planFileInput").click(); });
    $("planFileInput").addEventListener("change", importPlan);
    $("resetBtn").addEventListener("click", resetPlan);
    $("importMapBtn").addEventListener("click", function () { els.mapFileInput.click(); });
    $("placeholderImportBtn").addEventListener("click", function () { els.mapFileInput.click(); });
    $("retryMapBtn").addEventListener("click", retryMapLoad);
    els.mapFileInput.addEventListener("change", importMap);
    $("loadMapUrlBtn").addEventListener("click", loadMapUrl);
    $("mapUrlInput").addEventListener("keydown", function (event) { if (event.key === "Enter") loadMapUrl(); });
    $("zoomInBtn").addEventListener("click", function () { zoomAtMapCenter(state.zoom * 1.25); });
    $("zoomOutBtn").addEventListener("click", function () { zoomAtMapCenter(state.zoom / 1.25); });
    $("fitBtn").addEventListener("click", function () { state.zoom = 1; state.panX = 0; state.panY = 0; applyZoom(); saveState(); });
    els.mapStage.addEventListener("wheel", handleMapWheel, { passive: false });
    els.mapStage.addEventListener("pointerdown", beginPan);
    els.mapStage.addEventListener("contextmenu", function (event) { event.preventDefault(); });
    els.mapStage.addEventListener("click", handleMapClick);
    window.addEventListener("keydown", function (event) { if (event.target.matches("input,select,textarea")) return; if (event.key.toLowerCase() === "g") setMode("gun"); if (event.key.toLowerCase() === "t") setMode("target"); if (event.key === "Delete") deleteSelected(); });
  }

  function setMode(mode) { state.mode = mode; $("gunModeBtn").classList.toggle("active", mode === "gun"); $("targetModeBtn").classList.toggle("active", mode === "target"); updateStatus(); }

  function handleMapClick(event) {
    if (!event.fromTouch && Date.now() < touchClickUntil) return;
    if (suppressNextMapClick) { suppressNextMapClick = false; return; }
    if (event.target.closest("button") || event.target.closest(".marker")) return;
    if (event.button !== 0 || event.shiftKey) return;
    var point = mapPointAt(event.clientX, event.clientY);
    snapshot();
    if (state.mode === "gun") { state.gun = { x: point.x, y: point.y, elevation: Number(state.gunElevation) || 0 }; }
    else { var id = nextTargetId(); if (id == null) { window.alert('最多可添加 26 个目标，请先删除一个目标。'); return; } state.targets.push({ id: id, x: point.x, y: point.y, elevation: 0 }); state.selectedTargetId = id; mobileRevealTargetId = id; }
    render();
  }

  function nextTargetId() { var i = 0; while (i < 26 && state.targets.some(function (target) { return target.id === String.fromCharCode(65 + i); })) i++; return i < 26 ? String.fromCharCode(65 + i) : null; }
  function deleteSelected() { if (!state.selectedTargetId || !state.targets.length) return; snapshot(); state.targets = state.targets.filter(function (target) { return target.id !== state.selectedTargetId; }); state.selectedTargetId = state.targets.length ? state.targets[state.targets.length - 1].id : null; render(); }

  function render() {
    els.mapSelect.value = state.mapId; els.layerSelect.value = state.layer; els.weaponSelect.value = state.weaponId; $("gunElevation").value = state.gunElevation || 0;
    document.querySelectorAll(".layer-chip").forEach(function (b) { b.classList.toggle("active", b.dataset.layer === state.layer); });
    var map = effectiveMap(); var weapon = currentWeapon(); $("mapWidth").value = map.widthKm; $("mapHeight").value = map.heightKm; $("mapTitle").textContent = titleCaseMap(map.name); $("mapSize").textContent = formatMapKm(map.widthKm * 1000) + " × " + formatMapKm(map.heightKm * 1000) + " KM"; $("solutionMapCode").textContent = mapCode(map.name); $("weaponStatus").textContent = weapon.status === "table" ? "社区射表插值 / 最大射程 " + formatDistance(weapon.maxRange) : "社区弹道模型 / 理论最大射程 " + formatDistance(weapon.maxRange);
    if (["basemap", "topomap", "terrainmap"].indexOf(state.layer) < 0) state.layer = "basemap";
    els.layerSelect.value = state.layer;
    var imageSource = currentMapImageSource(map);
    els.mapImage.classList.remove("has-image");
    els.mapImage.style.backgroundImage = "";
    els.mapRaster.onload = function () { els.mapImage.classList.add("has-image"); };
    els.mapRaster.onerror = function () {
      if (els.mapRaster.dataset.fallbackUrl && els.mapRaster.dataset.fallbackTried !== "1") {
        els.mapRaster.dataset.fallbackTried = "1";
        els.mapRaster.src = els.mapRaster.dataset.fallbackUrl;
        return;
      }
      els.mapImage.classList.remove("has-image");
      els.mapImage.classList.add("map-load-failed");
      els.mapImage.querySelector(".map-placeholder p").textContent = "地图暂不可用";
      els.mapImage.querySelector(".map-placeholder small").textContent = map.name + " 底图加载失败。检查网络后重试，或导入本地地图图片。";
    };
    els.mapImage.classList.remove("map-load-failed");
    els.mapImage.querySelector(".map-placeholder p").textContent = "地图加载中";
    els.mapImage.querySelector(".map-placeholder small").textContent = "正在载入 " + map.name + " 地图底图";
    var fallbackUrl = !state.image && !state.imageUrl && state.layer === "basemap" ? map.basemapUrl : "";
    if (els.mapRaster.dataset.requestedSource !== imageSource) {
      els.mapRaster.dataset.requestedSource = imageSource;
      els.mapRaster.dataset.fallbackUrl = fallbackUrl;
      els.mapRaster.dataset.fallbackTried = "0";
      els.mapRaster.src = imageSource;
    }
    else if (els.mapRaster.complete && els.mapRaster.naturalWidth) els.mapImage.classList.add("has-image");
    els.mapRaster.alt = map.name + " 地图底图";
    $("mapUrlInput").value = state.imageUrl || "";
    resizeMapStage(map);
    renderGrid(map);
    applyZoom(); renderRange(); renderMarkers(); renderSolutions(); setMode(state.mode); saveState();
    if (window.lucide) window.lucide.createIcons();
  }

  function resizeMapStage(map) {
    var bounds = $("mapStageWrap").getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    var aspect = map.widthKm / map.heightKm;
    var width = Math.min(bounds.width * 0.92, 1000);
    var height = width / aspect;
    var maxHeight = bounds.height * 0.8;
    if (height > maxHeight) { height = maxHeight; width = height * aspect; }
    els.mapStage.style.width = Math.round(width) + "px";
    els.mapStage.style.height = Math.round(height) + "px";
  }

  function formatMapKm(value) {
    var formatted = Number(value / 1000).toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
    var decimalPlaces = formatted.indexOf(".") < 0 ? 0 : formatted.length - formatted.indexOf(".") - 1;
    if (!decimalPlaces) return formatted + ".000";
    return decimalPlaces < 3 ? formatted + new Array(4 - decimalPlaces).join("0") : formatted;
  }

  function renderGrid(map) {
    var widthMeters = map.widthKm * 1000;
    var heightMeters = map.heightKm * 1000;
    var majorStep = map.gridSizeMeters || 300;
    var svgNS = "http://www.w3.org/2000/svg";
    els.gridOverlay.setAttribute("viewBox", "0 0 1000 1000");
    els.gridOverlay.replaceChildren();
    function addLines(step, axis, extent) {
      var count = Math.ceil(extent / step) - 1;
      for (var i = 1; i <= count; i++) {
        var line = document.createElementNS(svgNS, "line");
        var meters = i * step;
        var position = meters / extent * 1000;
        var isMajor = Math.abs(meters / majorStep - Math.round(meters / majorStep)) < 0.000001;
        var isHundred = Math.abs(meters / (majorStep / 3) - Math.round(meters / (majorStep / 3))) < 0.000001;
        line.setAttribute("class", "grid-line" + (isMajor ? " major" : isHundred ? " detail detail-100" : " detail detail-33"));
        if (axis === "x") { line.setAttribute("x1", position); line.setAttribute("x2", position); line.setAttribute("y1", 0); line.setAttribute("y2", 1000); }
        else { line.setAttribute("x1", 0); line.setAttribute("x2", 1000); line.setAttribute("y1", position); line.setAttribute("y2", position); }
        els.gridOverlay.appendChild(line);
      }
    }
    addLines(majorStep / 9, "x", widthMeters);
    addLines(majorStep / 9, "y", heightMeters);
  }

  function retryMapLoad() {
    var source = currentMapImageSource(currentMap());
    els.mapImage.classList.remove("has-image", "map-load-failed");
    els.mapImage.querySelector(".map-placeholder p").textContent = "地图加载中";
    els.mapImage.querySelector(".map-placeholder small").textContent = "正在重试加载 " + currentMap().name + " 地图底图";
    els.mapRaster.dataset.requestedSource = "";
    els.mapRaster.dataset.fallbackTried = "0";
    els.mapRaster.removeAttribute("src");
    window.setTimeout(function () { els.mapRaster.src = source; }, 0);
  }

  function currentMapImageSource(map) {
    if (state.image) return state.image;
    if (state.imageUrl) return state.imageUrl;
    if (state.layer === "basemap") return map.localBasemapUrl || map.basemapUrl;
    return "https://squadcalc.app/api" + map.mapURL + state.layer + ".webp";
  }

  function mapPointAt(clientX, clientY) {
    var stageRect = els.mapStage.getBoundingClientRect();
    var width = els.mapImage.offsetWidth;
    var height = els.mapImage.offsetHeight;
    var left = stageRect.left + els.mapStage.clientLeft + els.mapImage.offsetLeft;
    var top = stageRect.top + els.mapStage.clientTop + els.mapImage.offsetTop;
    var x = ((clientX - (left + width / 2 + (state.panX || 0))) / state.zoom + width / 2) / width;
    var y = ((clientY - (top + height / 2 + (state.panY || 0))) / state.zoom + height / 2) / height;
    return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
  }

  function applyZoom() {
    state.zoom = clamp(Number(state.zoom) || 1, 1, 8);
    state.panX = Number(state.panX) || 0;
    state.panY = Number(state.panY) || 0;
    els.mapImage.style.transform = "translate3d(" + state.panX + "px," + state.panY + "px,0) scale(" + state.zoom + ")";
    els.mapImage.dataset.zoomTier = state.zoom >= 3.5 ? "2" : state.zoom >= 1.7 ? "1" : "0";
    positionMarkers();
  }

  function positionMarker(marker, point) {
    if (!marker || !point) return;
    var width = els.mapImage.offsetWidth;
    var height = els.mapImage.offsetHeight;
    marker.style.left = (width / 2 + (point.x - 0.5) * width * state.zoom + state.panX) + "px";
    marker.style.top = (height / 2 + (point.y - 0.5) * height * state.zoom + state.panY) + "px";
  }

  function positionMarkers() {
    if (!els.markersLayer) return;
    els.markersLayer.querySelectorAll(".marker").forEach(function (marker) {
      var point = marker.dataset.kind === "gun" ? state.gun : state.targets.find(function (target) { return target.id === marker.dataset.id; });
      positionMarker(marker, point);
    });
  }

  function zoomAtMapCenter(nextZoom) {
    var rect = els.mapStage.getBoundingClientRect();
    zoomAtPoint(nextZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function zoomAtPoint(nextZoom, clientX, clientY) {
    var next = clamp(nextZoom, 1, 8);
    if (next === state.zoom) return;
    var stageRect = els.mapStage.getBoundingClientRect();
    var width = els.mapImage.offsetWidth;
    var height = els.mapImage.offsetHeight;
    var left = stageRect.left + els.mapStage.clientLeft + els.mapImage.offsetLeft;
    var top = stageRect.top + els.mapStage.clientTop + els.mapImage.offsetTop;
    var localX = (clientX - (left + width / 2 + state.panX)) / state.zoom + width / 2;
    var localY = (clientY - (top + height / 2 + state.panY)) / state.zoom + height / 2;
    state.panX = clientX - left - width / 2 - (localX - width / 2) * next;
    state.panY = clientY - top - height / 2 - (localY - height / 2) * next;
    state.zoom = next;
    applyZoom();
    saveState();
  }

  function handleMapWheel(event) {
    event.preventDefault();
    zoomAtPoint(state.zoom * Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
  }

  function beginPan(event) {
    if (event.pointerType === 'touch') return;
    if (event.button === 0 && !event.shiftKey) return;
    if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
    event.preventDefault();
    suppressNextMapClick = true;
    var startX = event.clientX;
    var startY = event.clientY;
    var panX = state.panX || 0;
    var panY = state.panY || 0;
    els.mapStage.classList.add("is-panning");
    function move(e) { state.panX = panX + e.clientX - startX; state.panY = panY + e.clientY - startY; applyZoom(); }
    function end() {
      window.removeEventListener("pointermove", move);
      els.mapStage.classList.remove("is-panning");
      saveState();
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.setTimeout(function () { suppressNextMapClick = false; }, 0);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }
  function bindTouchMap() {
    var touches = new Map();
    var gesture = null;
    var lastPair = null;
    function pair() {
      var points = Array.from(touches.values());
      if (points.length < 2) return null;
      return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2, distance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)) };
    }
    els.mapStage.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'touch' || event.target.closest('button:not(.marker)')) return;
      event.preventDefault(); event.stopPropagation();
      touchClickUntil = Date.now() + 1000;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      els.mapStage.setPointerCapture(event.pointerId);
      if (touches.size === 1) {
        var marker = event.target.closest('.marker');
        var point = marker ? (marker.dataset.kind === 'gun' ? state.gun : state.targets.find(function (target) { return target.id === marker.dataset.id; })) : null;
        gesture = { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, marker: marker, point: point, original: point && { x: point.x, y: point.y }, moved: false, multi: false };
      } else { gesture.multi = true; lastPair = pair(); }
    }, true);
    els.mapStage.addEventListener('pointermove', function (event) {
      if (!touches.has(event.pointerId)) return;
      event.preventDefault();
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      var nextPair = pair();
      if (nextPair && lastPair) {
        zoomAtPoint(state.zoom * nextPair.distance / lastPair.distance, lastPair.x, lastPair.y);
        state.panX += nextPair.x - lastPair.x; state.panY += nextPair.y - lastPair.y;
        applyZoom(); lastPair = nextPair;
        return;
      }
      if (!gesture || gesture.multi) return;
      var dx = event.clientX - gesture.startX; var dy = event.clientY - gesture.startY;
      if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
      if (!gesture.moved) { snapshot(); gesture.moved = true; }
      if (gesture.point) {
        gesture.point.x = clamp(gesture.original.x + dx / (els.mapImage.offsetWidth * state.zoom), 0, 1);
        gesture.point.y = clamp(gesture.original.y + dy / (els.mapImage.offsetHeight * state.zoom), 0, 1);
        if (gesture.marker.dataset.kind === 'target') state.selectedTargetId = gesture.marker.dataset.id;
        renderMarkers(); renderRange(); renderSolutions();
      } else {
        state.panX += event.clientX - gesture.x; state.panY += event.clientY - gesture.y; applyZoom();
      }
      gesture.x = event.clientX; gesture.y = event.clientY;
    });
    function end(event) {
      if (!touches.has(event.pointerId)) return;
      event.preventDefault(); touches.delete(event.pointerId); touchClickUntil = Date.now() + 800;
      if (!touches.size) {
        if (gesture && !gesture.moved && !gesture.multi && event.type !== 'pointercancel') {
          if (gesture.marker) {
            if (gesture.marker.dataset.kind === 'target') state.selectedTargetId = gesture.marker.dataset.id;
            renderMarkers(); renderSolutions();
          } else handleMapClick({ fromTouch: true, target: els.mapStage, button: 0, clientX: event.clientX, clientY: event.clientY });
        }
        saveState(); gesture = null; lastPair = null;
      } else { lastPair = pair(); }
    }
    els.mapStage.addEventListener('pointerup', end);
    els.mapStage.addEventListener('pointercancel', end);
  }
  function createBlastRings(target, map, damageRadii) {
    if (!damageRadii) return null;
    var rings = document.createElement("div");
    rings.className = "target-rings";
    rings.dataset.targetId = target.id;
    rings.setAttribute("aria-hidden", "true");
    rings.style.left = (target.x * 100) + "%";
    rings.style.top = (target.y * 100) + "%";

    [
      { className: "damage-ring damage-ring-25", radius: damageRadii.twentyFiveDamageRadius },
      { className: "damage-ring damage-ring-100", radius: damageRadii.hundredDamageRadius }
    ].forEach(function (item) {
      var ring = document.createElement("span");
      ring.className = item.className;
      ring.style.width = ((item.radius * 2 / (map.widthKm * 1000)) * els.mapImage.clientWidth) + "px";
      ring.style.height = ((item.radius * 2 / (map.heightKm * 1000)) * els.mapImage.clientHeight) + "px";
      rings.appendChild(ring);
    });
    return rings;
  }
  function renderRange() {
    var weapon = currentWeapon();
    if (!state.gun || weapon.maxRange == null) {
      els.rangeRing.style.display = "none";
      els.rangeBadge.textContent = "MAX RANGE —";
      return;
    }
    var map = effectiveMap();
    var widthMeters = map.widthKm * 1000;
    var heightMeters = map.heightKm * 1000;
    els.rangeRing.style.display = "block";
    els.rangeRing.style.left = (state.gun.x * 100) + "%";
    els.rangeRing.style.top = (state.gun.y * 100) + "%";
    els.rangeRing.style.width = (weapon.maxRange * 2 / widthMeters * 100) + "%";
    els.rangeRing.style.height = (weapon.maxRange * 2 / heightMeters * 100) + "%";
    els.rangeRing.title = weapon.name + " 最大理论射程 " + formatDistance(weapon.maxRange);
    els.rangeBadge.textContent = "MAX RANGE " + formatDistance(weapon.maxRange);
  }

  function renderMarkers() {
    els.markersLayer.innerHTML = "";
    els.blastLayer.innerHTML = "";
    var map = effectiveMap();
    var damageRadii = MortarCalc.getDamageRadii(currentWeapon().id);
    if (state.gun) {
      var gun = document.createElement("button"); gun.type = "button"; gun.className = "marker gun"; gun.dataset.kind = "gun";
      gun.setAttribute("aria-label", "炮位，拖动可调整位置"); gun.title = "炮位 · 拖动调整";
      positionMarker(gun, state.gun);
      gun.innerHTML = "<span class=\"marker-glyph\"></span>"; els.markersLayer.appendChild(gun); bindDrag(gun, state.gun, "gun");
    }
    state.targets.forEach(function (target) {
      var reachable = state.gun ? compute(target).reachable : true;
      var rings = createBlastRings(target, map, damageRadii);
      if (rings) els.blastLayer.appendChild(rings);
      var marker = document.createElement("button"); marker.type = "button";
      marker.className = "marker target" + (target.id === state.selectedTargetId ? " selected" : "") + (reachable ? "" : " out-of-range");
      marker.dataset.kind = "target"; marker.dataset.id = target.id;
      marker.setAttribute("aria-label", "目标 " + target.id + (reachable ? "，在射程内" : "，超出射程") + (damageRadii ? "，100 伤害半径 " + formatRadius(damageRadii.hundredDamageRadius) + "，25 伤害半径 " + formatRadius(damageRadii.twentyFiveDamageRadius) : ""));
      marker.title = "目标 " + target.id + (reachable ? " · 射程内" : " · 超出射程") + (damageRadii ? " · 100 伤害 " + formatRadius(damageRadii.hundredDamageRadius) + " · 25 伤害 " + formatRadius(damageRadii.twentyFiveDamageRadius) : "");
      positionMarker(marker, target);
      marker.innerHTML = "<span class=\"marker-glyph\"></span>";
      marker.addEventListener("click", function (event) { event.stopPropagation(); state.selectedTargetId = target.id; renderMarkers(); renderSolutions(); saveState(); });
      els.markersLayer.appendChild(marker); bindDrag(marker, target, "target", rings);
    });
  }

  function bindDrag(marker, point, kind, overlay) {
    marker.addEventListener("pointerdown", function (event) {
      if (event.pointerType === 'touch' || event.shiftKey || event.button !== 0) return;
      event.stopPropagation(); event.preventDefault(); snapshot();
      function move(e) { var position = mapPointAt(e.clientX, e.clientY); point.x = position.x; point.y = position.y; positionMarker(marker, point); if (kind === "target") { state.selectedTargetId = marker.dataset.id; marker.classList.toggle("out-of-range", !compute(point).reachable); if (overlay) { overlay.style.left = (point.x * 100) + "%"; overlay.style.top = (point.y * 100) + "%"; } } else renderRange(); renderSolutions(); }
      function up() { window.removeEventListener("pointermove", move); saveState(); renderMarkers(); }
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up, { once: true });
    });
  }

  function effectiveMap() { var map = currentMap(); var saved = state.mapScales && state.mapScales[state.mapId]; return Object.assign({}, map, saved || {}); }
  function updateMapScale() {
    var width = Number($("mapWidth").value); var height = Number($("mapHeight").value);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    snapshot(); state.mapScales = state.mapScales || {}; state.mapScales[state.mapId] = { widthKm: width, heightKm: height }; render();
  }
  function compute(target) { var map = effectiveMap(); return MortarCalc.computeSolution(state.gun || { x: 0, y: 0 }, target, { mapId: state.mapId, weaponId: state.weaponId, mapWidthKm: map.widthKm, mapHeightKm: map.heightKm }); }
  function renderSolutionsLegacy() {
    var hasGun = !!state.gun; $("solutionCount").textContent = pad2(state.targets.length); els.solutionsList.innerHTML = ""; els.emptyState.style.display = hasGun && state.targets.length ? "none" : "flex";
    if (!hasGun) { $("solutionMeta").textContent = "等待放置炮位和目标"; $("totalDistance").textContent = "—"; $("maxDistance").textContent = "—"; return; }
    var total = 0; var max = 0; state.targets.forEach(function (target) { var solution = compute(target); total += solution.rangeMeters; max = Math.max(max, solution.rangeMeters); var card = document.createElement("article"); card.className = "solution-card" + (target.id === state.selectedTargetId ? " selected" : "") + (solution.reachable ? "" : " unreachable"); card.addEventListener("click", function () { state.selectedTargetId = target.id; renderMarkers(); renderSolutions(); saveState(); }); card.innerHTML = "<div class=\"solution-card-head\"><div class=\"target-label\"><span class=\"target-badge\">" + target.id + "</span>目标 " + target.id + "</div><div class=\"card-actions\"><button class=\"card-icon-btn copy-one\" title=\"复制该目标射击口令\"><i data-lucide=\"copy\"></i></button><button class=\"card-icon-btn delete-one\" title=\"删除该目标\"><i data-lucide=\"x\"></i></button></div></div><div class=\"solution-main\"><div><span class=\"metric-label\">距离</span><span class=\"metric-value\">" + formatDistance(solution.rangeMeters) + "</span></div><div><span class=\"metric-label\">方位角</span><span class=\"metric-value\">" + solution.bearingDeg.toFixed(1) + "° <small>/ " + solution.bearingMils + " mil</small></span></div></div><div class=\"solution-secondary\"><div><span class=\"metric-label\">仰角</span><span class=\"metric-value\">" + (solution.elevationMils == null ? "—" : solution.elevationMils + " mil") + "</span></div><div><span class=\"metric-label\">预计飞行</span><span class=\"metric-value\">" + (solution.flightTimeSeconds == null ? "—" : solution.flightTimeSeconds + " s") + "</span></div><div><span class=\"metric-label\">高度差</span><span class=\"metric-value\">" + (solution.deltaHeightMeters > 0 ? "+" : "") + solution.deltaHeightMeters + " m</span></div></div>" + (!solution.reachable ? "<div class=\"solution-warning\"><i data-lucide=\"triangle-alert\"></i> 超出当前武器射程或理论解不存在</div>" : ""); els.solutionsList.appendChild(card); card.querySelector(".copy-one").addEventListener("click", function (event) { event.stopPropagation(); copyText(formatCall(target, solution)); }); card.querySelector(".delete-one").addEventListener("click", function (event) { event.stopPropagation(); state.selectedTargetId = target.id; deleteSelected(); }); });
    $("solutionMeta").textContent = state.targets.length + " 个目标 / " + currentWeapon().shortName + " / " + state.layer; $("totalDistance").textContent = formatDistance(total); $("maxDistance").textContent = formatDistance(max); updateCoordinates(); if (window.lucide) window.lucide.createIcons();
  }

  function renderSolutions() {
    var hasGun = !!state.gun;
    $("solutionCount").textContent = pad2(state.targets.length);
    $("mobileSolutionCount").textContent = pad2(state.targets.length);
    els.solutionsList.innerHTML = "";
    els.mobileSolutionsList.innerHTML = "";
    els.emptyState.style.display = hasGun && state.targets.length ? "none" : "flex";
    if (!hasGun) {
      $("solutionMeta").textContent = "等待放置炮位和目标";
      $("mobileSolutionMeta").textContent = "放置炮位后显示解算";
      els.mobileSolutionsEmpty.textContent = "先在地图上放置炮位";
      els.mobileSolutionsEmpty.style.display = "block";
      $("totalDistance").textContent = "—";
      $("maxDistance").textContent = "—";
      mobileRevealTargetId = null;
      updateCoordinates();
      return;
    }
    els.mobileSolutionsEmpty.style.display = state.targets.length ? "none" : "block";
    els.mobileSolutionsEmpty.textContent = "标记目标后，距离与方位会显示在这里";
    var total = 0;
    var max = 0;
    state.targets.forEach(function (target) {
      var solution = compute(target);
      total += solution.rangeMeters;
      max = Math.max(max, solution.rangeMeters);
      var card = node("article", "solution-card" + (target.id === state.selectedTargetId ? " selected" : "") + (solution.reachable ? "" : " unreachable"));
      var head = node("div", "solution-card-head");
      var label = node("div", "target-label");
      label.appendChild(node("span", "target-badge", target.id));
      label.appendChild(document.createTextNode("目标 " + target.id));
      var actions = node("div", "card-actions");
      var copy = node("button", "card-icon-btn");
      copy.type = "button"; copy.title = "复制该目标射击口令"; copy.innerHTML = "<i data-lucide=\"copy\"></i>";
      var remove = node("button", "card-icon-btn");
      remove.type = "button"; remove.title = "删除该目标"; remove.innerHTML = "<i data-lucide=\"x\"></i>";
      actions.append(copy, remove); head.append(label, actions); card.appendChild(head);
      var main = node("div", "solution-main");
      addMetric(main, "距离", formatDistance(solution.rangeMeters));
      addMetric(main, "方位角", solution.bearingDeg.toFixed(1) + "° / " + solution.bearingMils + " mil");
      card.appendChild(main);
      var secondary = node("div", "solution-secondary");
      addMetric(secondary, "仰角", solution.elevationMils == null ? "—" : solution.elevationMils + " mil");
      addMetric(secondary, "预计飞行", solution.flightTimeSeconds == null ? "—" : solution.flightTimeSeconds + " s");
      addMetric(secondary, "高度差", (solution.deltaHeightMeters > 0 ? "+" : "") + solution.deltaHeightMeters + " m");
      card.appendChild(secondary);
      var damageRadii = MortarCalc.getDamageRadii(currentWeapon().id);
      if (damageRadii) {
        var blastMetrics = node("div", "blast-metrics");
        addMetric(blastMetrics, "100 伤害半径", formatRadius(damageRadii.hundredDamageRadius));
        addMetric(blastMetrics, "25 伤害半径", formatRadius(damageRadii.twentyFiveDamageRadius));
        card.appendChild(blastMetrics);
      }
      var height = node("label", "target-height", "目标高度");
      var heightInput = node("input", "target-elevation");
      heightInput.type = "number"; heightInput.min = "-500"; heightInput.max = "500"; heightInput.step = "1";
      heightInput.value = target.elevation || 0; heightInput.setAttribute("aria-label", "目标 " + target.id + " 高度");
      height.append(heightInput, document.createTextNode(" m")); card.appendChild(height);
      if (!solution.reachable) card.appendChild(node("div", "solution-warning", "超出当前武器射程或理论解不存在"));
      card.addEventListener("click", function () { state.selectedTargetId = target.id; renderMarkers(); renderSolutions(); saveState(); });
      copy.addEventListener("click", function (event) { event.stopPropagation(); copyText(formatCall(target, solution)); });
      remove.addEventListener("click", function (event) { event.stopPropagation(); state.selectedTargetId = target.id; deleteSelected(); });
      heightInput.addEventListener("click", function (event) { event.stopPropagation(); });
      heightInput.addEventListener("change", function (event) { event.stopPropagation(); target.elevation = Number(this.value) || 0; saveState(); renderSolutions(); });
      els.solutionsList.appendChild(card);

      var mobileRow = node("article", "mobile-solution-row" + (target.id === state.selectedTargetId ? " selected" : "") + (solution.reachable ? "" : " unreachable"));
      mobileRow.dataset.targetId = target.id;
      var mobileHead = node("div", "mobile-solution-head");
      var mobileLabel = node("div", "mobile-target-label");
      mobileLabel.appendChild(node("span", "target-badge", target.id));
      mobileLabel.appendChild(node("span", "", "目标 " + target.id));
      mobileHead.appendChild(mobileLabel);
      mobileHead.appendChild(node("strong", "mobile-distance", formatDistance(solution.rangeMeters)));
      var mobileActions = node("div", "card-actions");
      var mobileCopy = node("button", "card-icon-btn");
      mobileCopy.type = "button"; mobileCopy.title = "复制目标 " + target.id + " 射击口令"; mobileCopy.setAttribute("aria-label", mobileCopy.title); mobileCopy.innerHTML = "<i data-lucide=\"copy\"></i>";
      var mobileRemove = node("button", "card-icon-btn");
      mobileRemove.type = "button"; mobileRemove.title = "删除目标 " + target.id; mobileRemove.setAttribute("aria-label", mobileRemove.title); mobileRemove.innerHTML = "<i data-lucide=\"x\"></i>";
      mobileActions.append(mobileCopy, mobileRemove); mobileHead.appendChild(mobileActions); mobileRow.appendChild(mobileHead);
      var mobileValues = node("div", "mobile-solution-values");
      mobileValues.appendChild(node("span", "mobile-bearing", "方位 " + solution.bearingDeg.toFixed(1) + "° · " + solution.bearingMils + " mil"));
      mobileValues.appendChild(node("span", "mobile-range-state", solution.reachable ? "射程内" : "超射程"));
      mobileRow.appendChild(mobileValues);
      var mobileDetails = node("div", "mobile-solution-details");
      mobileDetails.appendChild(node("span", "", "仰角 " + (solution.elevationMils == null ? "—" : solution.elevationMils + " mil") + " · " + (solution.flightTimeSeconds == null ? "—" : solution.flightTimeSeconds + " s")));
      var mobileHeight = node("label", "mobile-target-height", "高程");
      var mobileHeightInput = node("input", "target-elevation");
      mobileHeightInput.type = "number"; mobileHeightInput.min = "-500"; mobileHeightInput.max = "500"; mobileHeightInput.step = "1";
      mobileHeightInput.value = target.elevation || 0; mobileHeightInput.setAttribute("aria-label", "目标 " + target.id + " 高程（米）");
      mobileHeight.append(mobileHeightInput, document.createTextNode("m")); mobileDetails.appendChild(mobileHeight); mobileRow.appendChild(mobileDetails);
      mobileRow.addEventListener("click", function () { state.selectedTargetId = target.id; renderMarkers(); renderSolutions(); saveState(); });
      mobileCopy.addEventListener("click", function (event) { event.stopPropagation(); copyText(formatCall(target, solution)); });
      mobileRemove.addEventListener("click", function (event) { event.stopPropagation(); state.selectedTargetId = target.id; deleteSelected(); });
      mobileHeightInput.addEventListener("click", function (event) { event.stopPropagation(); });
      mobileHeightInput.addEventListener("change", function (event) { event.stopPropagation(); target.elevation = Number(this.value) || 0; saveState(); renderSolutions(); });
      els.mobileSolutionsList.appendChild(mobileRow);
    });
    $("solutionMeta").textContent = state.targets.length + " 个目标 / " + currentWeapon().shortName + " / " + state.layer;
    $("mobileSolutionMeta").textContent = currentWeapon().shortName + " · " + state.layer;
    $("totalDistance").textContent = formatDistance(total);
    $("maxDistance").textContent = formatDistance(max);
    updateCoordinates();
    if (window.lucide) window.lucide.createIcons();
    if (mobileRevealTargetId) {
      var newRow = els.mobileSolutionsList.querySelector('[data-target-id="' + mobileRevealTargetId + '"]');
      if (newRow && window.matchMedia("(max-width: 860px)").matches) {
        var listBounds = els.mobileSolutionsList.getBoundingClientRect();
        var rowBounds = newRow.getBoundingClientRect();
        var rowTop = els.mobileSolutionsList.scrollTop + rowBounds.top - listBounds.top;
        els.mobileSolutionsList.scrollTop = Math.max(0, rowTop + newRow.offsetHeight - els.mobileSolutionsList.clientHeight);
      }
      mobileRevealTargetId = null;
    }
  }

  function formatCall(target, solution) { return "目标 " + target.id + " · " + solution.bearingMils + " mil · 仰角 " + (solution.elevationMils == null ? "—" : solution.elevationMils + " mil") + " · " + formatDistance(solution.rangeMeters); }
  function copySalvo() { if (!state.gun || !state.targets.length) return; copyText(state.targets.map(function (target) { return formatCall(target, compute(target)); }).join("\n")); }
  function copyText(text) { Platform.copyText(text).catch(function () { window.alert('复制失败，请重试。'); }); }
  function updateCoordinates() { if (!state.gun) { $("gunCoord").textContent = "GUN —"; return; } $("gunCoord").textContent = "GUN " + formatGrid(state.gun); var target = state.targets.find(function (t) { return t.id === state.selectedTargetId; }); $("targetCoord").textContent = target ? "TARGET " + formatGrid(target) : "TARGET —"; }
  function formatGrid(point) { return String(Math.round(point.x * 1000)).padStart(3, "0") + "/" + String(Math.round(point.y * 1000)).padStart(3, "0"); }
  function updateStatus() { var mode = state.mode === "gun" ? "放置炮位" : "添加目标"; $("statusText").textContent = mode + " / " + currentMap().name + " / " + state.layer; $("coordReadout").textContent = state.selectedTargetId ? "TARGET " + state.selectedTargetId + " / " + formatGrid(state.targets.find(function (t) { return t.id === state.selectedTargetId; }) || state.gun || { x: 0, y: 0 }) : "X 000 / Y 000"; }
  function importMap(event) { var file = event.target.files && event.target.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function () { state.image = reader.result; state.imageUrl = null; render(); }; reader.readAsDataURL(file); event.target.value = ""; }
  function loadMapUrl() {
    var value = $("mapUrlInput").value.trim();
    if (!value) { state.imageUrl = null; state.image = null; render(); return; }
    try {
      var url = new URL(value, window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported scheme");
      var probe = new Image();
      probe.onload = function () { snapshot(); state.image = null; state.imageUrl = url.href; render(); };
      probe.onerror = function () { window.alert("地图图片加载失败。请检查地址，并确认链接直接指向图片文件。"); };
      probe.src = url.href;
    } catch (e) {
      window.alert("请输入可访问的 http(s) 地图图片地址。");
    }
  }
  function exportPlan() { var payload = { version: 1, exportedAt: new Date().toISOString(), app: "SQD / FIRE CONTROL", mapId: state.mapId, layer: state.layer, weaponId: state.weaponId, gunElevation: state.gunElevation, mapScales: state.mapScales || {}, imageUrl: state.imageUrl || null, gun: state.gun, targets: state.targets }; Platform.savePlan(JSON.stringify(payload, null, 2)).catch(function () { window.alert('导出失败，请重试。'); }); }
  function importPlan(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var plan = JSON.parse(reader.result);
        var validPoint = function (point) { return point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1; };
        var weaponId = MortarCalc.normalizeWeaponId(plan && plan.weaponId);
        if (!plan || MortarCalc.findMap(plan.mapId).id !== plan.mapId || MortarCalc.findWeapon(weaponId).id !== weaponId || !Array.isArray(plan.targets) || plan.targets.length > 26 || !plan.targets.every(function (target) { return target && /^[A-Z]$/.test(target.id) && validPoint(target); }) || (plan.gun && !validPoint(plan.gun))) throw new Error("Invalid plan");
        if (new Set(plan.targets.map(function (target) { return target.id; })).size !== plan.targets.length) throw new Error("Duplicate target IDs");
        snapshot(); state.mapId = plan.mapId; state.layer = ["basemap", "topomap", "terrainmap"].indexOf(plan.layer) >= 0 ? plan.layer : "basemap"; state.weaponId = weaponId; state.gunElevation = Number(plan.gunElevation) || 0;
        state.zoom = 1; state.panX = 0; state.panY = 0;
        state.mapScales = {};
        MortarCalc.maps.forEach(function (map) { var scale = plan.mapScales && plan.mapScales[map.id]; if (scale && Number(scale.widthKm) > 0 && Number(scale.widthKm) <= 100 && Number(scale.heightKm) > 0 && Number(scale.heightKm) <= 100) state.mapScales[map.id] = { widthKm: Number(scale.widthKm), heightKm: Number(scale.heightKm) }; });
        state.gun = plan.gun || null; state.targets = plan.targets; state.selectedTargetId = state.targets.length ? state.targets[0].id : null; state.image = null; state.imageUrl = typeof plan.imageUrl === "string" ? plan.imageUrl : null; render();
      } catch (e) { window.alert("无法读取此火力计划文件。"); }
    };
    reader.readAsText(file); event.target.value = "";
  }
  function resetPlan() { snapshot(); state.gun = null; state.targets = []; state.selectedTargetId = null; state.image = null; state.imageUrl = null; render(); }
  document.addEventListener("DOMContentLoaded", init);
})();
