require 'signature/view_helpers'

module Signature
  class Engine < ::Rails::Engine
    isolate_namespace Signature
  end
end
