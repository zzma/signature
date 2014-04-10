require 'signature/view_helpers'

module Signature
  class Engine < ::Rails::Engine
    isolate_namespace Signature

    initializer "signature.view_helpers" do
      ActionView::Base.send :include, ViewHelpers
    end
  end
end
