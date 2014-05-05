require 'rails/generators/base'

module Signature
  module Generators
    class InstallGenerator < Rails::Generators::Base
      source_root File.expand_path("../templates", __FILE__)

      desc 'Signature Install Generator!!'

      def copy_models
        directory '../../../../app/models', 'app/models'
      end

      def copy_fonts
        directory '../../../../app/assets/fonts', 'app/assets/fonts'
      end
    end
  end
end