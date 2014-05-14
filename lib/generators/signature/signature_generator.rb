require 'rails/generators/named_base'

module Signature
  module Generators
    class SignatureGenerator < Rails::Generators::NamedBase
      include Rails::Generators::ResourceHelpers

      namespace "signature"
      source_root File.expand_path("../templates", __FILE__)

      desc "Generates a model with the given NAME (if one does not exist) " <<
               "plus a migration file."

      hook_for :orm
    end
  end
end