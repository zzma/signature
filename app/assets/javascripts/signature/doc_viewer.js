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

function scrollIntoView(element, spot, animate) {
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

    if (animate) {
        $(parent).animate({scrollTop: offsetY}, 500);
    } else {
        parent.scrollTop = offsetY;
    }
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
    currentDocumentIndex: 0, //0-based document index
    documentCount: null, //total number of documents


    initialize: function pdfViewInitialize() {
        var self = this;
        var container = this.container = document.getElementById('viewerContainer');
        this.pageViewScroll = {};

        this.watchScroll(container, this.pageViewScroll, updateViewarea);

        this.downloadManager = new DownloadManager();
        this.downloadManager.initialize();

        this.documentCount = document.getElementsByClassName('documentContainer').length;

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
            var currentPage = this.pages[0];
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
    //set the current document index
    set document(val) {
        var event = document.createEvent('UIEvents');
        event.initUIEvent('documentchange', false, false, window, 0);

        //check if the value is within range
        if (!(0 <= val && val < this.documentCount)) {
            event.documentIndex = this.currentDocumentIndex;
            window.dispatchEvent(event);
            return;
        }

        if (val != this.currentDocumentIndex) {
            //hide the old document
            this._hideDocument(this.currentDocumentIndex);

            this.currentDocumentIndex = val;

            //show the new document
            this._showDocument(this.currentDocumentIndex);

            event.documentIndex = val;
            window.dispatchEvent(event);

            this.currentScale = DEFAULT_SCALE;
            this._loadDocumentPages(this.currentDocumentIndex);

            //reset the page count
            this.page = 1;
        }
    },
    get document() {
        return this.currentDocumentIndex;
    },
    navigateTo: function pdfViewNavigateTo(dest){

    },
    error: function pdfVIewError(message, moreInfo) {

    },
    load: function pdfViewLoad(){
        var self = this;

        document.getElementById('numDocuments').innerHTML = 'Document <span id="documentNumber">2</span> of ' + this.documentCount;
        this._loadDocumentPages(this.currentDocumentIndex);

        //Set the initial document arrows
        var event = document.createEvent('UIEvents');
        event.initUIEvent('documentchange', false, false, window, 0);
        event.documentIndex = this.currentDocumentIndex;
        window.dispatchEvent(event);
    },
    _loadDocumentPages: function pdfView_loadDocumentPages(docIndex) {
        var self = this;
        var container = document.getElementById('viewer' + docIndex);
        var pagesCount = container.getElementsByTagName('img').length;

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
    },
    _hideDocument: function pdfView_hideDocument(index) {
        document.getElementById('document' + index).className += ' sigHidden';
    },
    _showDocument: function pdfView_showDocument(index) {
        var el = document.getElementById('document' + index);
        el.className = el.className.replace(/[ ]+sigHidden/, '');
    }
}

var PageView = function pageView(element, id, scale, navigateTo) {
    this.el = element;
    this.id = id;
    this.scale = scale || 'auto';

    this.initialize = function pageViewInitialize(){
        var self = this;
        var image = this.image = element.getElementsByTagName('img')[0];
        if (!image || image.length > 1) {
            console.error('Error initializing PageView');
            return;
        }

        if (!image.complete || image.naturalWidth === 0) {
            image.onload = function (){
                self._originalWidth = image.width;
                PDFView.setScale(scale);
            }
        } else {
            this._originalWidth = image.width;
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
        if (newWidth) {
            this.image.setAttribute('style', 'width:' + newWidth + 'px');
            this.image.parentNode.setAttribute('style', 'width:' + newWidth + 'px');
        } else {
            this.image.setAttribute('style', 'width: 100%');
            this.image.parentNode.setAttribute('style', 'width: 100%');
        }

    };

    this.scrollIntoView = function pageViewScrollIntoVIew(dest) {
        if (!dest) {
            scrollIntoView(element);
            return;
        }
    };
}


//TODO: implement download manager so that it downloads the current document
// <input type="hidden" id="downloadLink" value="<%= document.doc.url(:original, timestamp: false)%>"/>

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

var SignatureTool = (function(){
    var DRAWN_SIG = 'sig',
        TYPED_SIG = 'text',
        TYPE_FONT = 'tangerine',
        TYPE_FONT_URL = 'http://fonts.googleapis.com/css?family=Calligraffitti';


    var SignatureModal = {
        signButton: null,
        cancelButton: null,
        agreeCheckbox: null,
        drawTab: null,
        typeTab: null,
        drawPad: null,
        $signaturePad: null,
        typePad: null,
        typeText: null,
        nameInput: null,
        element: null,
        onSignatureHandler: null,
        undoButtonRenderer: function SignatureModalUndoButtonRenderer() {
            var $undoButton = $('<input type="button" value="Undo" id="undoButton" />')
                    .appendTo(this.$controlbarUpper)
            return $undoButton
        },
        initialize: function SignatureModalInitialize() {

            this.element = document.getElementById('signatureModal');
            this.signButton = document.getElementById('signSignature');
            this.cancelButton = document.getElementById('cancelSignature');
            this.agreeCheckbox = document.getElementById('agreeSignature');

            this.drawTab = document.getElementById('drawSignatureTab');
            this.typeTab = document.getElementById('typeSignatureTab');

            this.drawPad = document.getElementById('signaturePad');
            this.typePad = document.getElementById('signatureTypeWrapper');
            this.typeText = document.getElementById('signatureType');

//   font is already being set with @font-face in the css
            this.setTypeFont(TYPE_FONT, TYPE_FONT_URL);

            this.nameInput = document.getElementById('nameInput');

            this.$signaturePad = $('#signaturePad').jSignature({
                'UndoButton': this.undoButtonRenderer
            });

            this.element.style.display = 'none';
            this.element.style.opacity = 1;

            this.registerEvents();
        },
        show: function SignatureModalShow() {
            this.element.style.display = 'block';
        },
        hide: function SignatureModalHide() {
            this.element.style.display = 'none';
        },
        registerEvents: function SignatureModalRegisterEvents() {
            var self = this;

            this.agreeCheckbox.addEventListener('change', function(evt) {
                if (this.checked) {
                    self.signButton.className = '';
                } else {
                    self.signButton.className = 'inactive';
                }
            });

            this.cancelButton.addEventListener('click', function(evt) {
                self.hide();
                self.clearModal();
            });
            this.drawTab.addEventListener('click', function(evt) {
                self.typeTab.className = '';
                self.drawTab.className = 'active';
                self.drawPad.className = '';
                self.typePad.className = 'sigHidden';
            });
            this.typeTab.addEventListener('click', function(evt) {
                self.drawTab.className = '';
                self.typeTab.className = 'active';
                self.drawPad.className = 'sigHidden';
                self.typePad.className = '';
            });
            this.nameInput.addEventListener('keyup', function(evt){
                self.typeText.innerHTML = this.value;
            });
            this.signButton.addEventListener('click', function(evt) {
                //Check if the signature exists and user has agreed to terms
                if (self.drawTab.className.indexOf('active') != -1 &&
                    self.$signaturePad.jSignature('getData', 'native').length === 0) {
                    self.displayError('Please draw your signature');
                    return;
                }
                if (self.typeTab.className.indexOf('active') != -1 && !self.nameInput.value) {
                    self.displayError('Please type your signature');
                    return;
                }
                if (!self.agreeCheckbox.checked) {
                    self.displayError('Please agree to the Terms of Service');
                    return;
                }

                if (self.onSignatureHandler && typeof(self.onSignatureHandler) === 'function') {
                    var sig;
                    if (self.typeTab.className.indexOf('active') != -1) {
                        sig = new Signature(TYPED_SIG, self.nameInput.value);
                    } else if (self.drawTab.className.indexOf('active') != -1) {
                        sig = new Signature(DRAWN_SIG, self.$signaturePad.jSignature('getData', 'svg'));
                    }
                    self.onSignatureHandler(sig);
                }
            });
        },
        clearModal: function SignatureModalClearModal() {

        },
        setTypeFont: function SignatureModalSetTypeFont(fontName, fontUrl) {
//            //Activate a web-font
//            var fontLink = document.createElement('link');
//            fontLink.setAttribute('href', fontUrl);
//            fontLink.setAttribute('rel', 'stylesheet');
//            fontLink.setAttribute('type', 'text/css');
//
//            var head = document.getElementsByTagName('head')[0];
//            head.appendChild(fontLink);

            //Eagerly load a custom font
            var s = document.createElement('span');
            s.innerHTML = '&nbsp;';
            s.setAttribute('style', "font-family: 'tangerine' !important");
            s.style.visibility = 'hidden';
            s.style.position = 'absolute';
            s.style.top = '0px';
            s.style.left = '0px';
            s.style.height = '0px';
            s.style.width = '0px';
            document.body.appendChild(s);


            if (!this.typeText) {
                console.warn('typeText not assigned yet');
                return;
            }

            this.typeText.setAttribute('style', "font-family: '" + fontName + "', 'cursive' !important");
        },
        displayError: function SignatureModalDisplayError(text) {
            alert('ERROR MSG: ' + text);
        },
        //register a handler for when a signature is added
        onSignature: function SignatureModalOnSignature(handler) {
            this.onSignatureHandler = handler;
        }
    };

    var Signature = function Signature(type, data) {
        var s = {
            type: type,
            data: data,
            initialize: function SignatureInitialize() {
                //TODO: some validation
            }
        };

        s.initialize();

        return s;
    }

    var SignatureToolView = {
        nextButton: null,
        finishButton: null,
        signatureModal: null,
        nextHandler: null,
        submitHandler: null,
        initialize: function SignatureToolViewInitialize() {
            this.nextButton = document.getElementById('nextSignature');
            this.finishButton = document.getElementById('finishSigning');

            this.disableSubmit();

            this.setButtons(PDFView.documentCount <= 1);

            SignatureModal.initialize();
        },
        displaySignatureModal: function SignatureToolViewDisplaySignatureModal() {
            SignatureModal.show();
        },
        hideSignatureModal: function SignatureToolViewHideSignatureModal() {
            SignatureModal.hide();
        },
        //register a handler for when a signature is added
        onSignature: function SignatureToolViewOnSignature(handler) {
            SignatureModal.onSignature(handler);
        },
        onNext: function SignatureToolViewOnNext(handler) {
            this.nextHandler = handler;
            this.nextButton.addEventListener('click', this.nextHandler);
        },
        onSubmit: function SignatureToolViewOnSubmit(handler) {
            this.submitHandler = handler;
        },
        disableSubmit: function SignatureToolDisableSubmit() {
            this.nextButton.className = '';
            this.nextButton.addEventListener('click', this.nextHandler);
            this.finishButton.className = 'inactive';
            this.finishButton.removeEventListener('click', this.submitHandler);
        },
        enableSubmit: function SignatureToolEnableSubmit() {
            this.nextButton.className = 'inactive';
            this.nextButton.removeEventListener('click', this.nextHandler);
            this.finishButton.className = '';
            this.finishButton.addEventListener('click', this.submitHandler);
        },
        setButtons: function(lastDocument) {
            if (lastDocument) {
                this.finishButton.innerHTML = 'Submit <span class="desktop-only-inline">Document</span>';
            } else {
                this.finishButton.innerHTML = 'Next <span class="desktop-only-inline">Document</span>';
            }
        }
    }

    var SignatureFields = {
        nextSignature: null,
        selectedSignature: null,
        fields: [],
        initialize: function SignatureFieldsInitialize() {
            var data = JSON.parse(document.getElementById('viewer' + PDFView.document).getAttribute('data-fields'));
            var fields = this.fields;
            data.sort(function(a,b) {
                if (a.page > b.page) {
                    return 1;
                }
                if (a.page < b.page) {
                    return -1;
                }
                if (a.y > b.y) {
                    return -1;
                }
                if (a.y < b.y) {
                    return 1;
                }
                if (a.x > b.x) {
                    return 1;
                }
                if (a.x < b.x) {
                    return -1;
                }

                return 0;
            });

            var count = 0;
            for (var i = 0, len = data.length; i < len; i++) {
                if (data[i].tag_type == 'signature') {
                    var documentContainer = document.getElementById('document' + PDFView.document);
                    var container = documentContainer.getElementsByClassName('imageWrapper')[(data[i].page - 1)];
                    data[i].index = count++;
                    fields.push(new Field(container, data[i]));
                }
            }

            //Sort the list of fields by order in which they occur in the document
            fields.sort(function(a, b){
                if (a.page > b.page) {
                    return 1;
                }
                if (a.page < b.page) {
                    return -1;
                }
                if (a.originalY > b.originalY) {
                    return -1;
                }
                if (a.originalY < b.originalY) {
                    return 1;
                }
                if (a.originalX > b.originalX) {
                    return 1;
                }
                if (a.originalX < b.originalX) {
                    return -1;
                }

                return 0;
            });

            this.assignNextSignature();
        },
        setScale: function SignatureFieldsSetScale(scale) {
            this.fields.forEach(function(field) {
                field.setScale(scale);
                field.render();
            });
        },
        scrollToField: function SignatureFieldsScrollToField(index) {
            if (index >= 0 && index < this.fields.length) {
                scrollIntoView(this.fields[index].element, null ,true);
            }
        },
        scrollToNext: function SignatureFieldsScrollToNext() {
            this.scrollToField(this.nextSignature);
        },
        setSelected: function SignatureFieldsSetSelected(selectedEl) {
            if (!selectedEl || !selectedEl.id) {
                console.warn('No element selected');
                return;
            }

            var index = selectedEl.id.match(/\d+$/);

            if (!index) {
                console.warn('Selected element not found');
                return;
            }

            this.selectedSignature = index[0];
        },
        applySignature: function SignatureFieldsApplySignature(sig) {
            var parent = this.fields[this.selectedSignature].element;
            //Clear out any existing signatures
            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }

            if (sig.type === DRAWN_SIG) {
                var i = new Image();
                i.src = 'data:' + sig.data[0] + ';base64,' + btoa(sig.data[1]);

                i.style.width = '100%';
                i.style.height = '100%';

                parent.appendChild(i);
            } else if (sig.type === TYPED_SIG) {
                var d = document.createElement('div');
                d.innerHTML = sig.data;
                d.setAttribute('style', "font-family: '" + TYPE_FONT + "', 'cursive' !important");
                d.style.fontSize = Math.min(parent.offsetHeight - 2, (parent.offsetWidth/sig.data.length)) + 'px';
                d.style.lineHeight = parent.offsetHeight + 'px';

                parent.appendChild(d);
            }

            if (this.nextSignature == this.selectedSignature) {
                this.assignNextSignature();
            }

            this.selectedSignature = null;
        },
        assignNextSignature: function SignatureFieldAssignNextSignature() {
            var nextIndex = -1;
            for (var i = 0, len = this.fields.length; i < len; i++) {
                if (!this.fields[i].element.innerHTML) {
                    nextIndex = i;
                    break;
                }
            }

            this.nextSignature = nextIndex;
        },
        allSigned: function SignatureFieldAllSigned() {
            return (this.nextSignature == -1);
        },
        onFieldClick: function SignatureFieldsOnFieldClick(handler) {
            this.fields.forEach(function(field) {
                field.onClick(handler);
            });
        },
        destroyCurrent: function SignatureFieldsDestroyCurrent() {
            delete this.fields;
            this.fields = [];
            this.nextSignature = null;
            this.selectedSignature = null;
        }
    };

    var Field = function Field(container, options) {
        var f = {
            currentX: options.x,
            currentY: options.y,
            currentHeight: options.height,
            currentWidth: options.width,
            originalX: options.x,
            originalY: options.y,
            originalHeight: options.height,
            originalWidth: options.width,
            page: options.page,
            element: null,
            parent: null,
            initialize: function FieldInitialize() {
                this.parent = container;

                var el = this.element = document.createElement('div');
                el.className = 'signatureField noSelect';
                el.setAttribute('id', 'signatureField' + PDFView.document + '-' + options.index)
                el.style.position = 'absolute';

                container.appendChild(el);
            },
            get x() {
                return this.currentX;
            },
            get y() {
                return this.currentY;
            },
            get height() {
                return this.currentHeight;
            },
            get width() {
                return this.currentWidth
            },
            set x(val) {
                this.currentX = val;
            },
            set y(val) {
                this.currentY = val;
            },
            set height(val) {
                this.currentHeight = val;
            },
            set width(val) {
                this.currentWidth = val;
            },
            setScale: function FieldScale(scale) {
                this.currentX = this.originalX * scale;
                this.currentY = this.originalY * scale;
                this.currentHeight = this.originalHeight * scale;
                this.currentWidth = this.originalWidth * scale;
            },
            toConsole: function FieldToConsole(){
                console.log({
                    x: this.currentX,
                    y: this.currentY,
                    height: this.currentHeight,
                    width: this.currentWidth
                });
            },
            /**
             * Draws a signature field container at x,y relative to the parent container, where
             * (0,0) is the bottom left corner of the container
             *
             * @returns {HTMLElement} - the element that was created
             */

            render: function FieldRender() {
                var el = this.element;

                var parentHeight = this.parent.offsetHeight,
                    parentWidth = this.parent.offsetWidth;

                this.toConsole();
                console.log({
                    parentHeight: parentHeight,
                    parentWidth: parentWidth
                })

                el.style.bottom = this.currentY + 'px';
                el.style.left = this.currentX + 'px';
                el.style.top = (parentHeight - this.currentY - this.currentHeight) + 'px';
                el.style.right = (parentWidth - this.currentX - this.currentWidth) + 'px';

                return el;
            },
            onClick: function FieldOnClick(listener) {
                this.element.addEventListener('click', listener);
            }
        };

        f.initialize();

        return f;
    };

    var SignatureTool = {
        initialized: false,
        signature: null,
        initialize: function SignatureToolInitialize() {
            var self = this;
            SignatureToolView.initialize();

            this._createSignatureFields();

            SignatureToolView.onSignature(this.onSignatureHandler);

            SignatureToolView.onNext(function(){
                SignatureFields.scrollToNext();
            });

            SignatureToolView.onSubmit(function(){
                if (PDFView.document < PDFView.documentCount - 1) {
                    PDFView.document++;
                    SignatureToolView.setButtons(PDFView.document == PDFView.documentCount - 1);
                    SignatureToolView.nextButton.className = '';
                    SignatureToolView.disableSubmit();
                } else if (PDFView.document == PDFView.documentCount - 1) {
                    var sig = self.signature,
                        sigType = document.getElementById('sig_type'),
                        sigData = document.getElementById('sig_data'),
                        sigForm = document.getElementById('sig_form');


                    //Send data to the server
                    if (sig.type === DRAWN_SIG) {
                        sigType.value =  DRAWN_SIG;
                        sigData.value = $('#signaturePad').jSignature('getData', 'default');
                    } else if (sig.type === TYPED_SIG) {
                        sigType.value = TYPED_SIG;
                        sigData.value = sig.data;
                    }

                    sigForm.submit();
                }
            });



            this.initialized = true;
        },
        /**
         * Set the scale of the signature fields
         *
         * @param scale {float} - the absolute scale that
         */
        updateView: function SignatureToolSetScale(scale){
            if (this.initialized) {
                SignatureFields.setScale(scale);
            } else {
                console.warn('Not loaded');
            }
        },
        onSignatureHandler: function SignatureToolOnSignatureHandler(sig) {
            SignatureTool.signature = sig;
            SignatureFields.applySignature(sig);
            SignatureToolView.hideSignatureModal();
            if (SignatureFields.allSigned()) SignatureToolView.enableSubmit();
        },
        updateFields: function SignatureToolUpdateFields() {
            SignatureFields.destroyCurrent();
            this._createSignatureFields();
            setTimeout(function(){ST.updateView(PDFView.currentScale);}, 100);
        },
        _createSignatureFields: function SignatureTool_CreateSignatureFields() {
            var self = this;
            if (!viewOnly()){
                SignatureFields.initialize();

                SignatureFields.onFieldClick(function(){
                    SignatureFields.setSelected(this);
                    if (self.signature) {
                        SignatureFields.applySignature(self.signature);
                        if (SignatureFields.allSigned()) SignatureToolView.enableSubmit();
                    } else {
                        SignatureToolView.displaySignatureModal();
                    }
                });

                setTimeout(function(){ST.updateView(PDFView.currentScale);}, 200);
            }
        }
    }

    return SignatureTool;
});

var ST = new SignatureTool();

function webViewerLoad(evt) {
    PDFView.initialize();

    // TODO: initialize the signature tool after images have all been loaded - use promises
    ST.initialize();

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
            ST.updateView(PDFView.currentScale);
        });

    document.getElementById('zoomOut').addEventListener('click',
        function() {
            PDFView.zoomOut();
            ST.updateView(PDFView.currentScale);
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
            ST.updateView(PDFView.currentScale);
        });

    document.getElementById('download').addEventListener('click',
        function() {
            PDFView.download();
        });

    if (viewOnly()) {
        document.getElementById('previousDoc').addEventListener('click',
            function(){
                PDFView.document--;
            });

        document.getElementById('nextDoc').addEventListener('click',
            function(){
                PDFView.document++;
            });
    }

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

window.addEventListener('documentchange', function documentchange(evt){
    var doc = evt.documentIndex;

    if (viewOnly()) {
        document.getElementById('previousDoc').disabled = (doc <= 0);
        document.getElementById('nextDoc').disabled = (doc >= PDFView.documentCount - 1);
    }
    document.getElementById('documentNumber').innerHTML = doc + 1;

    if (doc > 0) {
        ST.updateFields();
    }
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
        if (document.getElementById('scaleSelect').value == 'auto') {
            PDFView.setScale(document.getElementById('scaleSelect').value);
            ST.updateView(PDFView.currentScale);
        }
    }
});

function viewOnly() {
    return document.getElementById('outerViewerContainer').getAttribute('data-signature') != 'true'
}