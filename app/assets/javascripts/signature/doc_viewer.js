/**
 * TODO: Keep track of view history - see PDF.js PDFView.store (ViewHistory)
 *
 */


if (typeof DocViewer === 'undefined') {
    (typeof window !== 'undefined' ? window : this).DocViewer = {};
}

var DEFAULT_SCALE = 'auto';
//var DEFAULT_SCALE = 0.3;
var MIN_SCALE = 0.1;
var MAX_SCALE = 4.0;
var MAX_AUTO_SCALE = 3.0;
var UNKNOWN_SCALE = 0;
var SCROLLBAR_PADDING = 40;
var VERTICAL_PADDING = 5;

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
    currentScale: UNKNOWN_SCALE,
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
        var callback = function(){
            console.log("Watchscrolll");
        };
        this.watchScroll(container, this.pageViewScroll, callback);

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

        console.log(scale);
        for (var i = 0, ii = this.pages.length; i < ii; i++) {
            this.pages[i].update(scale);
        }
        this.currentScale = scale;

        var event = document.createEvent('UIEvents');
        event.initUIEvent('scalechange', false, false, window, 0);
        event.scale = scale;
        window.dispatchEvent(event);

    },
    zoomIn: function pdfViewZoomIn(ticks) {

    },
    zoomOut: function pdfViewZoomOut(ticks) {

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

    }
}

var PageView = function pageView(element, id, scale, navigateTo) {
    this.el = element;
    this.id = id;
    this.scale = scale || 'auto';

    this.initialize = function pageViewInitialize(){
        var image = this.image = element.getElementsByTagName('img')[0];
        if (!image) {
            console.error('Error initializing PageView');
            return;
        }

        this._originalWidth = image.offsetWidth;

        if (scale != 1) {
            this.update(scale);
        }
    };
    this.setPdfPage = function pageViewSetPdfPage(pdfPage) {

    };
    this.reset = function pageViewReset() {

    };
    this.update = function pageViewUpdate(scale) {
        this.scale = scale || this.scale;

        var newWidth, newHeight;

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

    PDFView.load();
}

document.addEventListener('DOMContentLoaded', webViewerLoad, true);

function updateViewarea() {
    if (!PDFView.initialized) {
        return;
    }

    //TODO: make this pass
    var visible = PDFView.getVisiblePages();
    var visiblePages = visible.views;
    if (visiblePages.length === 0) {
        return;
    }

    PDFView.renderHighestPriority();

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

    var currentScale = PDFView.currentScale;
    var currentScaleValue = PDFView.currentScaleValue;
    var normalizedScaleValue = parseFloat(currentScaleValue) === currentScale ?
        Math.round(currentScale * 10000) / 100 : currentScaleValue;

    var pageNumber = firstPage.id;
    var pdfOpenParams = '#page=' + pageNumber;
    pdfOpenParams += '&zoom=' + normalizedScaleValue;
    var currentPage = PDFView.pages[pageNumber - 1];
    var container = PDFView.container;
    var topLeft = currentPage.getPagePoint((container.scrollLeft - firstPage.x),
        (container.scrollTop - firstPage.y));
    var intLeft = Math.round(topLeft[0]);
    var intTop = Math.round(topLeft[1]);
    pdfOpenParams += ',' + intLeft + ',' + intTop;

    PDFView.currentPosition = { page: pageNumber, left: intLeft, top: intTop };
}


window.addEventListener('scalechange', function scalechange(evt) {
    document.getElementById('zoomOut').disabled = (evt.scale === MIN_SCALE);
    document.getElementById('zoomIn').disabled = (evt.scale === MAX_SCALE);

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