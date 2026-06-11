/**
 * QËLLIMI: Stilet vizuale — SLD për shtresat administrative (WMS), ikona SVG/PNG për monumentet,
 *           grumbullimet (cluster) dhe shfaqja/fshirja e markerëve.
 * KUR NGARKOHET: Para map.js; përdoret gjatë krijimit të markerëve dhe shtresave WMS.
 * LIDHET ME: config.js (POINT_STYLES, MONUMENT_ICONS), map.js (createMonumentMarker),
 *             symbology-user.js (ngjyra të personalizuara), sidebar.js (legjenda).
 */

// ——— Shtresat administrative (rajonet, komunat, Kosova) ———

/** Ngjyra e butë për rajonet (vijat + etiketat) */
const RAJON_STROKE_COLOR = "#b8a574";
const RAJON_STROKE_OPACITY = 0.72;

/** Renditje: rajonet poshtë, komunat sipër, Kosova më sipër të gjithave */
const ADMIN_LAYER_Z_INDEX = {
  rajonet: 410,
  komunat: 430,
  kosova: 520,
};

/** Trashësi vijash — Kosova më e trashë, pastaj rajonet, komunat më të holla */
const ADMIN_BORDER_WEIGHT = {
  kosova: 2.8,
  rajonet: 1.75,
  komunat: 1.1,
};

const WMS_SLD = {
  kosova: `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc">
  <NamedLayer>
    <Name>Kosova</Name>
    <UserStyle>
      <FeatureTypeStyle>
        <Rule>
          <PolygonSymbolizer>
            <Fill>
              <CssParameter name="fill">#2dd4bf</CssParameter>
              <CssParameter name="fill-opacity">0</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#2dd4bf</CssParameter>
              <CssParameter name="stroke-width">${ADMIN_BORDER_WEIGHT.kosova}</CssParameter>
              <CssParameter name="stroke-opacity">0.95</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#2dd4bf</CssParameter>
              <CssParameter name="stroke-width">${ADMIN_BORDER_WEIGHT.kosova}</CssParameter>
              <CssParameter name="stroke-opacity">0.95</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`,

  komunat: `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc">
  <NamedLayer>
    <Name>Komunat</Name>
    <UserStyle>
      <FeatureTypeStyle>
        <Rule>
          <PolygonSymbolizer>
            <Fill>
              <CssParameter name="fill">#2dd4bf</CssParameter>
              <CssParameter name="fill-opacity">0</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#5eead4</CssParameter>
              <CssParameter name="stroke-width">${ADMIN_BORDER_WEIGHT.komunat}</CssParameter>
              <CssParameter name="stroke-opacity">0.9</CssParameter>
              <CssParameter name="stroke-dasharray">6 4</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#5eead4</CssParameter>
              <CssParameter name="stroke-width">${ADMIN_BORDER_WEIGHT.komunat}</CssParameter>
              <CssParameter name="stroke-opacity">0.9</CssParameter>
              <CssParameter name="stroke-dasharray">6 4</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`,

  rajonet: `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc">
  <NamedLayer>
    <Name>Rajonet</Name>
    <UserStyle>
      <FeatureTypeStyle>
        <Rule>
          <PolygonSymbolizer>
            <Fill>
              <CssParameter name="fill">#fbbf24</CssParameter>
              <CssParameter name="fill-opacity">0</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">${RAJON_STROKE_COLOR}</CssParameter>
              <CssParameter name="stroke-width">${ADMIN_BORDER_WEIGHT.rajonet}</CssParameter>
              <CssParameter name="stroke-opacity">${RAJON_STROKE_OPACITY}</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">${RAJON_STROKE_COLOR}</CssParameter>
              <CssParameter name="stroke-width">${ADMIN_BORDER_WEIGHT.rajonet}</CssParameter>
              <CssParameter name="stroke-opacity">${RAJON_STROKE_OPACITY}</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`,
};

const POLYGON_WMS_STYLE = {
  kosova: { sld_body: WMS_SLD.kosova, opacity: 1 },
  komunat: { sld_body: WMS_SLD.komunat, opacity: 1 },
  rajonet: { sld_body: WMS_SLD.rajonet, opacity: 0.95 },
};

/** Rajonet — WFS vektor (WMS rezervë) */
const RAJONET_STYLE = {
  color: RAJON_STROKE_COLOR,
  weight: ADMIN_BORDER_WEIGHT.rajonet,
  opacity: RAJON_STROKE_OPACITY,
  fill: false,
  fillOpacity: 0,
};

/** Komunat — GeoJSON statik (i njëjti stil si WMS: teal, vijë e ndërprerë) */
const KOMUNAT_VECTOR_STYLE = {
  color: "#5eead4",
  weight: ADMIN_BORDER_WEIGHT.komunat,
  opacity: 0.9,
  dashArray: "6 4",
  fill: false,
  fillOpacity: 0,
};

/** Kufiri i Kosovës — vektor (WFS) ose WMS rezervë */
const KOSOVA_BORDER_STYLE = {
  color: "#2dd4bf",
  weight: ADMIN_BORDER_WEIGHT.kosova,
  opacity: 0.95,
  fill: false,
  fillOpacity: 0,
};

// ——— Ikona dhe markerët e monumenteve ———

/** Kthen HTML të SVG-së së pin-it sipas llojit (arkeologjike, arkitekturore, luajtshme). */
function getMonumentIconSvgHtml(typeKey, styleOverride) {
  const s = styleOverride || POINT_STYLES[typeKey] || {};
  const fill = s.fill || "#64748b";
  const stroke = s.stroke || fill;
  const light = "#fff7f3";

  if (typeKey === "arkeologjike") {
    return (
      '<svg class="tkk-pin__svg" viewBox="0 0 40 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path fill="' +
      light +
      '" stroke="' +
      stroke +
      '" stroke-width="1.35" stroke-linejoin="round" d="M6 40h28v-2.2H6zm4-5.5h20V19.5L20 8.5 10 19.5v15zm2.2 0h15.6V21.2l-7.8-6.8-7.8 6.8v13.3zM8 16.5h24v2.8H8z"/>' +
      '<path fill="' +
      fill +
      '" d="M11.2 37.5h2.2v4.5h-2.2zm15.4 0h2.2v4.5h-2.2z"/>' +
      "</svg>"
    );
  }

  if (typeKey === "arkitekturore") {
    return (
      '<svg class="tkk-pin__svg" viewBox="0 0 40 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path fill="' +
      light +
      '" stroke="' +
      stroke +
      '" stroke-width="1.35" d="M8 40h24v-2H8zm1-4 3-14h16l3 14H9zm4-2h14l-2.5-10H15.5L13 34zm-1-12h18v2H12z"/>' +
      '<path fill="' +
      fill +
      '" stroke="' +
      stroke +
      '" stroke-width="1" d="M20 10 L28 18 H12z"/>' +
      "</svg>"
    );
  }

  if (typeKey === "luajtshme") {
    return (
      '<svg class="tkk-pin__svg" viewBox="0 0 40 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path fill="' +
      light +
      '" stroke="' +
      stroke +
      '" stroke-width="1.35" d="M10 38h20v-2H10zm2-4h16v-10l-8-6-8 6v10zm1.5-2h13v-7.5l-6.5-4.8-6.5 4.8V32z"/>' +
      '<ellipse fill="' +
      fill +
      '" cx="20" cy="14" rx="5" ry="3"/>' +
      "</svg>"
    );
  }

  return (
    '<span class="tkk-pin__dot" style="--pin-color:' + fill + '"></span>'
  );
}

/** Mbështjell ikonën në div për legjendë ose HTML të markerit (img + SVG rezervë). */
function monumentIconHtml(typeKey, extraClass, styleOverride) {
  const url = getMonumentIconUrl(typeKey);
  const svg = getMonumentIconSvgHtml(typeKey, styleOverride);
  const cls =
    "tkk-pin tkk-pin--monument tkk-pin--" +
    typeKey +
    (extraClass ? " " + extraClass : "");

  const imgPart = url
    ? '<img class="tkk-pin__img" src="' +
      url +
      '" alt="" onerror="this.style.display=\'none\';var w=this.nextElementSibling;if(w)w.hidden=false;" />'
    : "";

  const svgWrap =
    '<span class="tkk-pin__svg-wrap"' + (url ? " hidden" : "") + ">" + svg + "</span>";

  const inner = '<div class="' + cls + '">' + imgPart + svgWrap + "</div>";
  if (styleOverride?.filtered) {
    return wrapFilteredMarkerHtml(inner);
  }
  return inner;
}

/** Shton rrethin e ngjyrës pas ikonës për monumentet e filtruara. */
function wrapFilteredMarkerHtml(innerHtml) {
  return (
    '<div class="tkk-marker-wrap tkk-marker-wrap--filtered">' +
    '<span class="tkk-filter-mask" aria-hidden="true"></span>' +
    innerHtml +
    "</div>"
  );
}

/** Krijon L.divIcon për Leaflet (PNG ose SVG sipas konfigurimit). */
function createMonumentIcon(typeKey, styleOverride) {
  const cfg = MONUMENT_ICONS[typeKey] || {};
  const url = getMonumentIconUrl(typeKey);
  const vis = cfg.size || [18, 18];
  const baseHit = cfg.hitSize || [
    Math.max(28, vis[0] + 12),
    Math.max(28, vis[1] + 12),
  ];
  const isFiltered = !!styleOverride?.filtered;
  const hit = isFiltered
    ? [Math.max(baseHit[0], 36), Math.max(baseHit[1], 36)]
    : baseHit;
  const anchor = cfg.anchor || [hit[0] / 2, hit[1]];

  const filteredCls = isFiltered ? " tkk-img-marker--filtered" : "";
  const mutedCls =
    styleOverride?.muted && !isFiltered ? " tkk-img-marker--muted" : "";
  const markerCls = filteredCls + mutedCls;
  const maskParentCls = isFiltered ? " tkk-marker-has-filter-mask" : "";

  if (url && cfg.file) {
    const imgHtml =
      '<img class="tkk-img-marker tkk-img-marker--' +
      typeKey +
      markerCls +
      '" src="' +
      url +
      '" alt="" />';
    return L.divIcon({
      className:
        "tkk-marker-leaflet tkk-marker-hit" + maskParentCls + markerCls,
      html: isFiltered ? wrapFilteredMarkerHtml(imgHtml) : imgHtml,
      iconSize: L.point(hit[0], hit[1]),
      iconAnchor: L.point(anchor[0], anchor[1]),
    });
  }

  return L.divIcon({
    className:
      "tkk-marker-leaflet tkk-img-marker--" +
      typeKey +
      maskParentCls +
      markerCls,
    html: monumentIconHtml(
      typeKey,
      isFiltered
        ? "tkk-img-marker--filtered"
        : styleOverride?.muted
          ? "tkk-img-marker--muted"
          : "",
      styleOverride
    ),
    iconSize: L.point(hit[0], hit[1]),
    iconAnchor: L.point(anchor[0], anchor[1]),
  });
}

/** Marker i plotë me hover dhe stil të mundshëm nga përdoruesi. */
function createMonumentMarker(latlng, typeKey, feature) {
  const styleOverride =
    feature && typeof window.getStyleForFeature === "function"
      ? window.getStyleForFeature(feature, typeKey)
      : null;
  const marker = L.marker(latlng, {
    icon: createMonumentIcon(typeKey, styleOverride),
    riseOnHover: true,
    interactive: true,
    keyboard: false,
    zIndexOffset: 800,
  });
  marker._tkkType = typeKey;

  marker.on("mouseover", function () {
    const el = this.getElement();
    if (el) el.classList.add("tkk-img-marker--hover");
  });
  marker.on("mouseout", function () {
    const el = this.getElement();
    if (el) el.classList.remove("tkk-img-marker--hover");
  });

  return marker;
}

/** Grup cluster për një lloj monumenti (numri në rreth me ngjyrën e llojit). */
function createTypeClusterGroup(typeKey) {
  if (typeof L.markerClusterGroup !== "function") {
    return L.layerGroup();
  }

  const s =
    (typeof window.getTypePointStyle === "function"
      ? window.getTypePointStyle(typeKey)
      : null) ||
    POINT_STYLES[typeKey] ||
    {};

  return L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 42,
    spiderfyOnMaxZoom: false,
    zoomToBoundsOnClick: false,
    disableClusteringAtZoom: 13,
    chunkedLoading: true,
    iconCreateFunction: function (cluster) {
      const n = cluster.getChildCount();
      const sizeClass = n >= 10 ? " tkk-cluster--md" : "";
      const live =
        typeof window.getTypePointStyle === "function"
          ? window.getTypePointStyle(typeKey)
          : s;
      const fill = live.fill || "#64748b";
      const stroke = live.stroke || fill;

      return L.divIcon({
        html:
          '<div class="tkk-cluster tkk-cluster--' +
          typeKey +
          sizeClass +
          '" style="--cluster-color:' +
          fill +
          ";--cluster-stroke:" +
          stroke +
          '"><span>' +
          n +
          "</span></div>",
        className: "tkk-cluster-leaflet",
        iconSize: [22, 22],
      });
    },
  });
}

/** Shton ose heq markerin nga cluster-i kur filtri/ shtresa e fiket. */
function setMarkerVisible(marker, cluster, show) {
  if (!marker || !cluster) return;

  if (show) {
    if (!cluster.hasLayer(marker)) cluster.addLayer(marker);
    const el = marker.getElement();
    if (el) {
      el.style.display = "";
      el.style.opacity = "1";
      el.style.pointerEvents = "auto";
    }
    marker._tkkHidden = false;
  } else {
    if (cluster.hasLayer(marker)) cluster.removeLayer(marker);
    marker._tkkHidden = true;
  }
}

/** Rifreskon pamjen e të gjitha grupeve të cluster pas ndryshimeve. */
function refreshAllClusters() {
  (window.tkkClusterGroups || []).forEach((cg) => {
    if (cg.refreshClusters) cg.refreshClusters();
  });
}

window.WMS_SLD = WMS_SLD;
window.POLYGON_WMS_STYLE = POLYGON_WMS_STYLE;
window.KOMUNAT_VECTOR_STYLE = KOMUNAT_VECTOR_STYLE;
window.RAJONET_STYLE = RAJONET_STYLE;
window.ADMIN_LAYER_Z_INDEX = ADMIN_LAYER_Z_INDEX;
window.ADMIN_BORDER_WEIGHT = ADMIN_BORDER_WEIGHT;
window.createMonumentMarker = createMonumentMarker;
window.monumentIconHtml = monumentIconHtml;
window.getMonumentIconSvgHtml = getMonumentIconSvgHtml;
window.createTypeClusterGroup = createTypeClusterGroup;
window.setMarkerVisible = setMarkerVisible;
window.refreshAllClusters = refreshAllClusters;

// Eksport global për map.js, filters.js dhe symbology-user.js

