(function () {
  var FONTS = window.FONTS || [];
  var GLYPH_CAPTION = window.GLYPH_CAPTION || "";
  var FONT_NAME = (FONTS[0] && FONTS[0].name) || "";

  var root = document.getElementById("specimen-root");
  if (!root) return;

  document.documentElement.style.setProperty("--font-name", '"' + FONT_NAME + '"');
  document.title = "trvco studio";

  root.innerHTML = `
<div class="grain">
  <div class="wrap">

    <div class="tabs" id="tabs">
      <select class="tab font-select" id="font-select"></select>
      <div class="tab-group">
        <button class="tab active" data-panel="glyphsheet">Glyphs</button>
        <button class="tab" data-panel="sizeramp">Sizes</button>
        <button class="tab" data-panel="poster">Custom</button>
      </div>
    </div>

    <div class="panel active" id="panel-glyphsheet">
      <div class="glyph-row" id="gs-row-upper1">ABCDEFGHIJKLM</div>
      <div class="glyph-row" id="gs-row-upper2">NOPQRSTUVWXYZ</div>
      <div class="glyph-row" id="gs-row-lower1">abcdefghijklm</div>
      <div class="glyph-row" id="gs-row-lower2">nopqrstuvwxyz</div>
      <div class="glyph-row" id="gs-row3">0123456789</div>
      <div class="glyph-row" id="gs-row4"></div>
      <div class="footer-cap"><span id="glyph-caption"></span></div>
    </div>

    <div class="panel" id="panel-sizeramp">
      <div id="ramp-rows"></div>
    </div>

    <div class="panel" id="panel-poster">
      <div class="poster-lines" id="poster-lines" contenteditable="true" spellcheck="false">Try out your own text</div>
      <div class="field-row">
        <span class="field-label">SIZE</span>
        <input type="range" id="poster-slider" min="20" max="220" value="120">
      </div>
    </div>

  </div>
</div>
  `;

  document.getElementById("gs-row4").textContent = "!@#$%&*?/[{(.,;:'\"~)}]";
  document.getElementById("glyph-caption").textContent = GLYPH_CAPTION;

  var measureCanvas = document.createElement("canvas");
  var mctx = measureCanvas.getContext("2d");

  function measureWidth(text, px) {
    mctx.font = px + "px " + FONT_NAME;
    return mctx.measureText(text).width || 1;
  }

  function fitToWidth(text, targetWidth, opts) {
    opts = opts || {};
    var probe = 300;
    var w = measureWidth(text, probe);
    var size = probe * (targetWidth / w);
    if (opts.max) size = Math.min(size, opts.max);
    if (opts.min) size = Math.max(size, opts.min);
    return size;
  }

  function contentWidth(panelEl) {
    return panelEl.getBoundingClientRect().width;
  }

  function pixelsMatch(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 3; i < a.length; i += 4) { // alpha channel only
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Detects whether the active font has true lowercase letterforms, vs. a
  // unicase font where a-z is just a duplicate of A-Z -- runs live in the
  // browser against whatever font is currently selected, by rasterizing each
  // a/A pair on a canvas and comparing pixel alpha data. Doing this at
  // runtime (rather than baking a yes/no in at build time) means it keeps
  // working correctly no matter which font this page's FONTS array names,
  // and it re-checks on every style switch rather than assuming every style
  // in the dropdown shares one font's case behavior.
  function detectHasLowercase(fam) {
    var size = 64;
    var pad = 12;
    var dim = size + pad * 2;
    var c = document.createElement("canvas");
    c.width = dim;
    c.height = dim;
    var ctx = c.getContext("2d");
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#000";

    function raster(ch) {
      ctx.clearRect(0, 0, dim, dim);
      ctx.font = size + "px '" + fam + "'";
      ctx.fillText(ch, pad, dim - pad);
      return ctx.getImageData(0, 0, dim, dim).data;
    }

    var total = 0;
    var distinct = 0;
    for (var i = 97; i <= 122; i++) {
      total++;
      if (!pixelsMatch(raster(String.fromCharCode(i)), raster(String.fromCharCode(i - 32)))) {
        distinct++;
      }
    }
    return total > 0 && (distinct / total) > 0.5;
  }

  function updateGlyphSheetCase() {
    var lower1 = document.getElementById("gs-row-lower1");
    var lower2 = document.getElementById("gs-row-lower2");
    if (!lower1 || !lower2) return;
    var display = detectHasLowercase(FONT_NAME) ? "" : "none";
    lower1.style.display = display;
    lower2.style.display = display;
  }

  // Floor size for glyph rows -- keeps the sheet legible on narrow phones.
  var GLYPH_MIN_SIZE = 48;

  // The numbers/symbols row (gs-row4, plus gs-row3) still renders as ONE
  // continuous string that wraps naturally at container width -- no
  // hardcoded split point there. Sizing is computed off a HALF-length
  // substring of that same string rather than the full thing: fitting the
  // full string to the container width would shrink long rows drastically
  // to force them onto one line, which is what wrapping is supposed to
  // avoid. Sizing off half the string means the full string naturally lands
  // on roughly two lines at a much larger, more legible size.
  function halfOf(text) {
    return text.slice(0, Math.ceil(text.length / 2)) || text;
  }

  function fitGlyphSheet() {
    var panel = document.getElementById("panel-glyphsheet");
    var w = contentWidth(panel);

    var upper1 = document.getElementById("gs-row-upper1");
    var upper2 = document.getElementById("gs-row-upper2");
    var lower1 = document.getElementById("gs-row-lower1");
    var lower2 = document.getElementById("gs-row-lower2");
    var lowerVisible = !!lower1 && lower1.style.display !== "none";

    // Fit every visible half-row independently, then use the smallest result
    // so all of them (A-N, O-Z, a-n, o-z) render at one shared size -- keeps
    // the two/four lines visually matched instead of each drifting to its
    // own best-fit size.
    var upperSize = fitToWidth(upper1 ? upper1.textContent : "", w, {max: 100});
    if (upper2) upperSize = Math.min(upperSize, fitToWidth(upper2.textContent, w, {max: 100}));
    if (lowerVisible) {
      upperSize = Math.min(upperSize, fitToWidth(lower1.textContent, w, {max: 100}));
      upperSize = Math.min(upperSize, fitToWidth(lower2.textContent, w, {max: 100}));
    }
    upperSize = Math.max(upperSize, GLYPH_MIN_SIZE);
    if (upper1) upper1.style.fontSize = upperSize + "px";
    if (upper2) upper2.style.fontSize = upperSize + "px";
    if (lowerVisible) {
      lower1.style.fontSize = upperSize + "px";
      lower2.style.fontSize = upperSize + "px";
    }

    var row3 = document.getElementById("gs-row3");
    var row4 = document.getElementById("gs-row4");
    var midMin = GLYPH_MIN_SIZE * 0.62;
    var midSize = upperSize * 0.62;
    if (row3) midSize = Math.min(midSize, fitToWidth(halfOf(row3.textContent), w));
    if (row4) midSize = Math.min(midSize, fitToWidth(halfOf(row4.textContent), w));
    midSize = Math.max(midSize, midMin);
    if (row3) row3.style.fontSize = midSize + "px";
    if (row4) row4.style.fontSize = midSize + "px";
  }

  var RAMP_SIZES = [144, 96, 64, 42, 28, 18];

  // Tracks whether the user has hand-edited the size-ramp sample text. Until
  // they do, the sample text defaults to (and updates with) the active
  // font's own name -- once they've typed something custom, switching
  // styles in the dropdown shouldn't stomp on it.
  var rampUserEdited = false;

  function buildRampRows() {
    var container = document.getElementById("ramp-rows");
    container.innerHTML = "";
    RAMP_SIZES.forEach(function(pt, i) {
      var row = document.createElement("div");
      row.className = "ramp-row";
      var word = document.createElement("div");
      word.className = "ramp-word";
      word.dataset.pt = pt;
      if (i === 0) {
        word.id = "ramp-master";
        word.contentEditable = "true";
        word.spellcheck = false;
        word.textContent = FONT_NAME;
        word.addEventListener("input", function() {
          rampUserEdited = true;
          fitSizeRamp();
        });
        word.addEventListener("keydown", function(e) {
          if (e.key === "Enter") { e.preventDefault(); word.blur(); }
        });
      }
      var label = document.createElement("span");
      label.className = "ramp-label";
      label.textContent = pt + "PT";
      row.appendChild(word);
      row.appendChild(label);
      container.appendChild(row);
    });
  }

  function fitSizeRamp() {
    var panel = document.getElementById("panel-sizeramp");
    var master = document.getElementById("ramp-master");
    var text = (master ? master.textContent : "") || FONT_NAME;
    var w = contentWidth(panel) - 90;
    var words = document.querySelectorAll("#ramp-rows .ramp-word");
    var basePx = fitToWidth(text, w, {max: 340});
    var scale = basePx / RAMP_SIZES[0];
    var sizes = RAMP_SIZES.map(function(pt) { return pt * scale; });
    var widest = 0;
    sizes.forEach(function(px) {
      widest = Math.max(widest, measureWidth(text, px));
    });
    if (widest > w) {
      var adjust = w / widest;
      sizes = sizes.map(function(px) { return px * adjust; });
    }
    words.forEach(function(el, i) {
      if (el.id !== "ramp-master") el.textContent = text;
      el.style.fontSize = Math.max(sizes[i], 10) + "px";
    });
  }

  var posterUserAdjusted = false;
  var posterTyped = false;

  function fitPoster() {
    var panel = document.getElementById("panel-poster");
    var container = document.getElementById("poster-lines");
    var slider = document.getElementById("poster-slider");
    var w = contentWidth(panel) * 0.96;
    var raw = container.innerText || "Try out your own text";

    var size;
    if (posterUserAdjusted || !posterTyped) {
      // stay on the slider's own value (starts at the middle of the track)
      // until the user actually types real content -- prevents the
      // placeholder text's auto-fit width from silently dragging the slider
      // to the far end.
      size = parseFloat(slider.value);
    } else {
      // size is driven by the longest single word, not the longest full
      // line -- long lines wrap naturally (browser reflow) instead of
      // shrinking the whole specimen down to fit -- unless the user has
      // taken manual control via the slider.
      var words = raw.split(/\s+/).filter(function(w){ return w.length > 0; });
      var longestWord = "";
      words.forEach(function(word) {
        if (word.length > longestWord.length) longestWord = word;
      });
      if (!longestWord) longestWord = FONT_NAME.toUpperCase();

      size = fitToWidth(longestWord, w, {max: 220, min: 20});
      var wordWidthAtSize = measureWidth(longestWord, size);
      if (wordWidthAtSize > w) {
        size = size * (w / wordWidthAtSize);
      }
      slider.value = size;
    }

    container.style.fontSize = size + "px";
  }

  function refitActive() {
    var active = document.querySelector(".panel.active");
    if (!active) return;
    var id = active.id;
    if (id === "panel-glyphsheet") fitGlyphSheet();
    else if (id === "panel-sizeramp") fitSizeRamp();
    else if (id === "panel-poster") fitPoster();
  }

  // Switches the select + tab-group from side-by-side to stacked (full-width
  // select, equally-spaced tabs) the moment they no longer fit on one line --
  // works at any viewport width, not just a fixed mobile breakpoint.
  function updateTabsLayout() {
    var tabsEl = document.getElementById("tabs");
    var select = document.getElementById("font-select");
    if (select.style.display === "none") return;
    var group = tabsEl.querySelector(".tab-group");
    tabsEl.classList.remove("stacked");
    var wrapped = group.getBoundingClientRect().top > select.getBoundingClientRect().top + 2;
    if (wrapped) tabsEl.classList.add("stacked");
  }

  // Scoped to .tab-group .tab (not plain .tab) because the style <select>
  // also carries the "tab" class for shared pill styling -- querying plain
  // ".tab" here would attach this same click handler to the select, and
  // clicking it to open the dropdown would wipe every panel's "active" class
  // (then throw on the select's missing data-panel, aborting before any
  // panel got reactivated) -- collapsing the whole specimen to blank.
  root.querySelectorAll(".tab-group .tab").forEach(function(btn) {
    btn.addEventListener("click", function() {
      root.querySelectorAll(".tab-group .tab").forEach(function(b){ b.classList.remove("active"); });
      root.querySelectorAll(".panel").forEach(function(p){ p.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.panel).classList.add("active");
      refitActive();
    });
  });

  document.getElementById("poster-lines").addEventListener("input", function() {
    posterTyped = true;
    fitPoster();
  });

  document.getElementById("poster-slider").addEventListener("input", function() {
    posterUserAdjusted = true;
    fitPoster();
  });

  window.addEventListener("resize", refitActive);
  window.addEventListener("resize", updateTabsLayout);

  buildRampRows();

  function initialFit() {
    updateGlyphSheetCase();
    fitGlyphSheet();
    fitSizeRamp();
    fitPoster();
    updateTabsLayout();
  }

  function loadFontAndFit(fam) {
    if (document.fonts && document.fonts.ready) {
      document.fonts.load('300px "' + fam + '"').then(function() {
        return document.fonts.ready;
      }).then(initialFit).catch(initialFit);
      setTimeout(initialFit, 300);
    } else {
      initialFit();
    }
  }

  function setActiveFont(fam) {
    FONT_NAME = fam;
    document.documentElement.style.setProperty("--font-name", '"' + fam + '"');
    if (!rampUserEdited) {
      var master = document.getElementById("ramp-master");
      if (master) master.textContent = fam;
    }
    loadFontAndFit(fam);
  }

  // style dropdown -- populated from window.FONTS (this page's own config);
  // hidden automatically when only one font style is defined.
  var fontSelect = document.getElementById("font-select");
  if (FONTS.length > 1) {
    FONTS.forEach(function(f) {
      var opt = document.createElement("option");
      opt.value = f.name;
      opt.textContent = f.name;
      fontSelect.appendChild(opt);
    });
    fontSelect.value = FONT_NAME;
    fontSelect.addEventListener("change", function() {
      setActiveFont(fontSelect.value);
    });
  } else {
    fontSelect.style.display = "none";
    document.getElementById("tabs").classList.add("single-font");
  }
  updateTabsLayout();

  loadFontAndFit(FONT_NAME);
})();
