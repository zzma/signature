/**
 * TODO: Keep track of view history - see PDF.js PDFView.store (ViewHistory)
 *
 */


if (typeof DocViewer === 'undefined') {
    (typeof window !== 'undefined' ? window : this).DocViewer = {};
}

var DEFAULT_SCALE = 'auto';
var DEFAULT_SCALE_DELTA = 1.1;
var MIN_SCALE = 0.1;
var MAX_SCALE = 4.0;
var MAX_AUTO_SCALE = 3.0;
var SCROLLBAR_PADDING = 40;
var VERTICAL_PADDING = 5;

// Validates if URL is safe and allowed, e.g. to avoid XSS.
function isValidUrl(url, allowRelative) {
    if (!url) {
        return false;
    }
    // RFC 3986 (http://tools.ietf.org/html/rfc3986#section-3.1)
    // scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
    var protocol = /^[a-z][a-z0-9+\-.]*(?=:)/i.exec(url);
    if (!protocol) {
        return allowRelative;
    }
    protocol = protocol[0].toLowerCase();
    switch (protocol) {
        case 'http':
        case 'https':
        case 'ftp':
        case 'mailto':
            return true;
        default:
            return false;
    }
}
DocViewer.isValidUrl = isValidUrl;


// optimised CSS custom property getter/setter
var CustomStyle = (function CustomStyleClosure() {

    // As noted on: http://www.zachstronaut.com/posts/2009/02/17/
    //              animate-css-transforms-firefox-webkit.html
    // in some versions of IE9 it is critical that ms appear in this list
    // before Moz
    var prefixes = ['ms', 'Moz', 'Webkit', 'O'];
    var _cache = {};

    function CustomStyle() {}

    CustomStyle.getProp = function get(propName, element) {
        // check cache only when no element is given
        if (arguments.length == 1 && typeof _cache[propName] == 'string') {
            return _cache[propName];
        }

        element = element || document.documentElement;
        var style = element.style, prefixed, uPropName;

        // test standard property first
        if (typeof style[propName] == 'string') {
            return (_cache[propName] = propName);
        }

        // capitalize
        uPropName = propName.charAt(0).toUpperCase() + propName.slice(1);

        // test vendor specific properties
        for (var i = 0, l = prefixes.length; i < l; i++) {
            prefixed = prefixes[i] + uPropName;
            if (typeof style[prefixed] == 'string') {
                return (_cache[propName] = prefixed);
            }
        }

        //if all fails then set to undefined
        return (_cache[propName] = 'undefined');
    };

    CustomStyle.setProp = function set(propName, element, str) {
        var prop = this.getProp(propName);
        if (prop != 'undefined') {
            element.style[prop] = str;
        }
    };

    return CustomStyle;
})();

function scrollIntoView(element, spot) {
    // Assuming offsetParent is available (it's not available when viewer is in
    // hidden iframe or object). We have to scroll: if the offsetParent is not set
    // producing the error. See also animationStartedClosure.
    var parent = element.offsetParent;
    var offsetY = element.offsetTop + element.clientTop;
    var offsetX = element.offsetLeft + element.clientLeft;
    if (!parent) {
        console.error('offsetParent is not set -- cannot scroll');
        return;
    }
    while (parent.clientHeight === parent.scrollHeight) {
        if (parent.dataset._scaleY) {
            offsetY /= parent.dataset._scaleY;
            offsetX /= parent.dataset._scaleX;
        }
        offsetY += parent.offsetTop;
        offsetX += parent.offsetLeft;
        parent = parent.offsetParent;
        if (!parent) {
            return; // no need to scroll
        }
    }
    if (spot) {
        if (spot.top !== undefined) {
            offsetY += spot.top;
        }
        if (spot.left !== undefined) {
            offsetX += spot.left;
            parent.scrollLeft = offsetX;
        }
    }
    parent.scrollTop = offsetY;
}

var PDFView = {
    pages: [],
    currentScale: DEFAULT_SCALE,
    currentScaleValue: null,
    container: null,
    initialized: false,
    isViewerEmbedded: (window.parent !== window),
    mouseScrollTimeStamp: 0,
    mouseScrollDelta: 0,
    lastScroll: 0,
    currentPosition: null,
    currentPageNumber: 1,

    initialize: function pdfViewInitialize() {
        var self = this;
        var container = this.container = document.getElementById('viewerContainer');
        this.pageViewScroll = {};

        this.watchScroll(container, this.pageViewScroll, updateViewarea);

        this.downloadManager = new DownloadManager();
        this.downloadManager.initialize();

        this.initialized = true;
        container.addEventListener('scroll', function(){
           self.lastScroll = Date.now();
        }, false);
    },
    watchScroll: function pdfViewWatchScroll(viewAreaElement, state, callback) {
        viewAreaElement.addEventListener('scroll', function webViewerScroll(evt){
            var currentY = viewAreaElement.scrollTop;
            var lastY = state.lastY;
            if (currentY > lastY) {
                state.down = true;
            } else if (currentY < lastY) {
                state.down = false;
            }
            // else do nothing and use previous value
            state.lastY = currentY;
            callback();
        }, true);
    },
    setScale: function pdfViewSetScale(value, noScroll){
        var scale = parseFloat(value);

        if (isNaN(scale)) {
            var currentPage = this.pages[this.page - 1];
            var pageWidthScale = (this.container.clientWidth - SCROLLBAR_PADDING) /
                currentPage._originalWidth;
            var pageHeightScale = (this.container.clientHeight - VERTICAL_PADDING) /
                currentPage._originalHeight;

            switch (value) {
//                case 'page-actual':
//                    scale = 1;
//                    break;
//                case 'page-width':
//                    scale = pageWidthScale;
//                    break;
//                case 'page-height':
//                    scale = pageHeightScale;
//                    break;
//                case 'page-fit':
//                    scale = Math.min(pageWidthScale, pageHeightScale);
//                    break;
                case 'auto':
                    scale = Math.min(MAX_AUTO_SCALE, pageWidthScale);
                    break;
                default:
                    console.error('pdfViewSetScale: \'' + value +
                        '\' is an unknown zoom value.');
                    return;
            }
        }

        scale = scale.toFixed(2);

        for (var i = 0, ii = this.pages.length; i < ii; i++) {
            this.pages[i].update(scale);
        }
        this.currentScale = scale;

        var event = document.createEvent('UIEvents');
        event.initUIEvent('scalechange', false, false, window, 0);
        event.scale = scale;
        window.dispatchEvent(event);

        selectScaleOption(value);
    },
    zoomIn: function pdfViewZoomIn(ticks) {
        var newScale = this.currentScale;
        do {
            newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
            newScale = Math.ceil(newScale * 10) / 10;
            newScale = Math.min(MAX_SCALE, newScale);
        } while (--ticks && newScale > MAX_SCALE);
        this.setScale(newScale);
    },
    zoomOut: function pdfViewZoomOut(ticks) {
        var newScale = this.currentScale;
        do {
            newScale = (newScale / DEFAULT_SCALE_DELTA).toFixed(2);
            newScale = Math.floor(newScale * 10) / 10;
            newScale = Math.max(MIN_SCALE, newScale);
        } while (--ticks && newScale < MIN_SCALE);
        this.setScale(newScale);
    },
    set page(val) {
        var pages = this.pages;
        var event = document.createEvent('UIEvents');
        event.initUIEvent('pagechange', false, false, window, 0);

        if (!(0 < val && val <= pages.length)){
            this.previousPageNumber = val;
            event.pageNumber = this.page;
            window.dispatchEvent(event);
            return;
        }

        this.previousPageNumber = this.currentPageNumber;
        this.currentPageNumber = val;
        event.pageNumber = val;
        window.dispatchEvent(event);

        // checking if the this.page was called from the updateViewarea function:
        // avoiding the creation of two "set page" method (internal and public)
        if (updateViewarea.inProgress) {
            return;
        }
        pages[val - 1].scrollIntoView();
    },
    get page() {
        return this.currentPageNumber;
    },
    download: function pdfViewDownload(){
        this.downloadManager.download();
    },
    navigateTo: function pdfViewNavigateTo(dest){

    },
    error: function pdfVIewError(message, moreInfo) {

    },
    load: function pdfViewLoad(){
        var self = this;

        var container = document.getElementById('viewer');
        var pagesCount = container.children.length;

        document.getElementById('numPages').textContent = 'of ' + pagesCount;
        document.getElementById('pageNumber').max = pagesCount;

        var pages = this.pages = [];

        for (var i = 0; i < pagesCount; i++) {
            pages.push(new PageView(container.children[i], i+1, DEFAULT_SCALE, self.navigateTo.bind(self)));
            pages[i].initialize();
        }

        //Set the initial page numbering
        var event = document.createEvent('UIEvents');
        event.initUIEvent('pagechange', false, false, window, 0);
        event.pageNumber = this.currentPageNumber;
        window.dispatchEvent(event);

        this.setScale(DEFAULT_SCALE);

    },
    getVisiblePages: function pdfViewGetVisiblePages() {
        return this.getVisibleElements(this.container, this.pages, true);
    },
    getVisibleElements: function pdfViewGetVisibleElements(scrollEl, views, sortByVisibility) {
        var top = scrollEl.scrollTop, bottom = top + scrollEl.clientHeight;
        var left = scrollEl.scrollLeft, right = left + scrollEl.clientWidth;

        var visible = [], view;
        var currentHeight, viewHeight, hiddenHeight, percentHeight;
        var currentWidth, viewWidth;
        for (var i = 0, ii = views.length; i < ii; ++i) {
            view = views[i];
            currentHeight = view.el.offsetTop + view.el.clientTop;
            viewHeight = view.el.clientHeight;
            if ((currentHeight + viewHeight) < top) {
                continue;
            }
            if (currentHeight > bottom) {
                break;
            }
            currentWidth = view.el.offsetLeft + view.el.clientLeft;
            viewWidth = view.el.clientWidth;
            if ((currentWidth + viewWidth) < left || currentWidth > right) {
                continue;
            }
            hiddenHeight = Math.max(0, top - currentHeight) +
                Math.max(0, currentHeight + viewHeight - bottom);
            percentHeight = ((viewHeight - hiddenHeight) * 100 / viewHeight) | 0;

            visible.push({ id: view.id, x: currentWidth, y: currentHeight,
                view: view, percent: percentHeight });
        }

        var first = visible[0];
        var last = visible[visible.length - 1];

        if (sortByVisibility) {
            visible.sort(function(a, b) {
                var pc = a.percent - b.percent;
                if (Math.abs(pc) > 0.001) {
                    return -pc;
                }
                return a.id - b.id; // ensure stability
            });
        }
        return {first: first, last: last, views: visible};
    }
}

var PageView = function pageView(element, id, scale, navigateTo) {
    this.el = element;
    this.id = id;
    this.scale = scale || 'auto';

    this.initialize = function pageViewInitialize(){
        var self = this;
        var image = this.image = element.getElementsByTagName('img')[0];
        if (!image) {
            console.error('Error initializing PageView');
            return;
        }

        if (image.offsetWidth  === 0) {
            image.onload = function (){
                self._originalWidth = image.offsetWidth;
                PDFView.setScale(scale);
            }
        } else {
            this._originalWidth = image.offsetWidth;
            PDFView.setScale(scale);
        }

    };
    this.setPdfPage = function pageViewSetPdfPage(pdfPage) {

    };
    this.reset = function pageViewReset() {

    };
    this.update = function pageViewUpdate(scale) {
        this.scale = scale || this.scale;

        var newWidth;

        if (scale >= MIN_SCALE && scale <= MAX_SCALE) {
            newWidth = this._originalWidth * scale;
        } else if (scale == 'auto') {
            var viewerEl = document.getElementById('viewerContainer');
            newWidth = viewerEl.offsetWidth - SCROLLBAR_PADDING;
        }
        //change the size of the element and its child image
        this.image.setAttribute('style', 'width:' + newWidth + 'px');
    };

    this.scrollIntoView = function pageViewScrollIntoVIew(dest) {
        if (!dest) {
            scrollIntoView(element)
            return;
        }
    };
}


var DownloadManager = (function PDFDownloadClosure() {

    function download(url, filename) {
        var a = document.createElement('a');
        if (a.click) {
            // Use a.click() if available. Otherwise, Chrome might show
            // "Unsafe JavaScript attempt to initiate a navigation change
            //  for frame with URL" and not open the PDF at all.
            // Supported by (not mentioned = untested):
            // - Firefox 6 - 19 (4- does not support a.click, 5 ignores a.click)
            // - Chrome 19 - 26 (18- does not support a.click)
            // - Opera 9 - 12.15
            // - Internet Explorer 6 - 10
            // - Safari 6 (5.1- does not support a.click)
            a.href = url;
            a.target = '_parent';
            // Use a.download if available. This increases the likelihood that
            // the file is downloaded instead of opened by another PDF plugin.
            if ('download' in a) {
                a.download = filename;
            }
            // <a> must be in the document for IE and recent Firefox versions.
            // (otherwise .click() is ignored)
            (document.body || document.documentElement).appendChild(a);
            a.click();
            a.parentNode.removeChild(a);
        } else {
            window.open(url, '_parent');

            var hiddenIFrameID = 'hiddenDownloader',
                iframe = document.getElementById(hiddenIFrameID);
            if (iframe === null) {
                iframe = document.createElement('iframe');
                iframe.id = hiddenIFrameID;
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }
            iframe.src = url;
        }
    }

    function DownloadManager() {}

    DownloadManager.prototype = {
        initialize: function DownloadManager_initialize() {
            var dl = document.getElementById('downloadLink');
            this.downloadUrl = dl ? dl.value : this.downloadUrl;
            this.filename = this.extractFilename(this.downloadUrl);
        },
        download: function DownloadManager_downloadUrl() {
            if (!DocViewer.isValidUrl(this.downloadUrl, true)) {
                return; // restricted/invalid URL
            }

            download(this.downloadUrl, this.filename);
        },
        extractFilename: function DownloadManager_extractFilename(url) {
            if (!url || url.indexOf('/') === -1) return url;

            filename = url.split('/');
            filename = filename[filename.length - 1];

            if (!filename || filename.indexOf('.') === -1) return url;

            return filename;
        }
    };

    return DownloadManager;
})();


function webViewerLoad(evt) {
    PDFView.initialize();

    var mainContainer = document.getElementById('mainViewerContainer');
    var outerContainer = document.getElementById('outerViewerContainer');

    document.getElementById('previous').addEventListener('click',
        function() {
            PDFView.page--;
        });

    document.getElementById('next').addEventListener('click',
        function() {
            PDFView.page++;
        });

    document.getElementById('zoomIn').addEventListener('click',
        function() {
            PDFView.zoomIn();
        });

    document.getElementById('zoomOut').addEventListener('click',
        function() {
            PDFView.zoomOut();
        });

    document.getElementById('pageNumber').addEventListener('click',
        function() {
            this.select();
        });

    document.getElementById('pageNumber').addEventListener('change',
        function() {
            // Handle the user inputting a floating point number.
            PDFView.page = Math.floor(this.value);

            if (this.value !== Math.floor(this.value).toString()) {
                this.value = PDFView.page;
            }
        });

    document.getElementById('scaleSelect').addEventListener('change',
        function() {
            PDFView.setScale(this.value);
        });

    document.getElementById('download').addEventListener('click',
        function() {
            PDFView.download();
        });

    PDFView.load();
}

document.addEventListener('DOMContentLoaded', webViewerLoad, true);

function updateViewarea() {
    if (!PDFView.initialized) {
        return;
    }

    var visible = PDFView.getVisiblePages();
    var visiblePages = visible.views;
    if (visiblePages.length === 0) {
        return;
    }

    var currentId = PDFView.page;
    var firstPage = visible.first;

    for (var i = 0, ii = visiblePages.length, stillFullyVisible = false;
         i < ii; ++i) {
        var page = visiblePages[i];

        if (page.percent < 100) {
            break;
        }
        if (page.id === PDFView.page) {
            stillFullyVisible = true;
            break;
        }
    }

    if (!stillFullyVisible) {
        currentId = visiblePages[0].id;
    }

    updateViewarea.inProgress = true; // used in "set page"
    PDFView.page = currentId;
    updateViewarea.inProgress = false;
}


window.addEventListener('scalechange', function scalechange(evt) {
    document.getElementById('zoomOut').disabled = (evt.scale == MIN_SCALE);
    document.getElementById('zoomIn').disabled = (evt.scale == MAX_SCALE);

//    updateViewarea();
}, true);

window.addEventListener('pagechange', function pagechange(evt) {
    var page = evt.pageNumber;
    if (PDFView.previousPageNumber !== page) {
        document.getElementById('pageNumber').value = page;
    }

    document.getElementById('previous').disabled = (page <= 1);
    document.getElementById('next').disabled = (page >= PDFView.pages.length);
}, true);

function selectScaleOption(value) {
    var options = document.getElementById('scaleSelect').options;
    var predefinedValueFound = false;
    for (var i = 0, ii = options.length; i < ii; i++) {
        var option = options[i];
        if (option.value != value) {
            option.selected = false;
            continue;
        }
        option.selected = true;
        predefinedValueFound = true;
    }

    var customScaleOption = document.getElementById('customScaleOption');
    customScaleOption.selected = false;

    if (!predefinedValueFound) {
        customScaleOption.textContent = Math.round(parseFloat(value) * 10000) / 100 + '%';
        customScaleOption.value = true;
        customScaleOption.selected = true;
    }

    return predefinedValueFound;
}

window.addEventListener('resize', function webViewerResize(evt){
    if (PDFView.initialized) {
        PDFView.setScale(document.getElementById('scaleSelect').value);
    }
});