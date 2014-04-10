module Signature
  module ViewHelpers
    def doc_viewer
      content_tag(:p, "Hello, Doc Viewer!")
    end
    def sig_doc_viewer
      content_tag(:p, "Hello, Sig Doc Viewer!")
    end
  end
end