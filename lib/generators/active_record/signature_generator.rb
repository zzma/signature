require 'rails/generators/active_record'
require 'generators/signature/orm_helpers'

module ActiveRecord
  module Generators
    class SignatureGenerator < ActiveRecord::Generators::Base
      argument :attributes, type: :array, default: [], banner: "field:type field:type"

      include Signature::Generators::OrmHelpers
      source_root File.expand_path("../templates", __FILE__)

      def copy_signature_migration
        if (behavior == :invoke && migration_exists?(table_name)) || (behavior == :revoke && migration_exists?(table_name))
          migration_template "doc_migration_existing.rb", "db/migrate/add_signature_to_#{table_name}.rb"
          migration_template "doc_image_migration.rb", "db/migrate/signature_create_#{table_name.singularize}_images.rb"
          migration_template "doc_tag_migration.rb", "db/migrate/signature_create_#{table_name.singularize}_tags.rb"
        else
          migration_template "doc_migration.rb", "db/migrate/signature_create_#{table_name}.rb"
          migration_template "doc_image_migration.rb", "db/migrate/signature_create_#{table_name.singularize}_images.rb"
          migration_template "doc_tag_migration.rb", "db/migrate/signature_create_#{table_name.singularize}_tags.rb"
        end
      end
      def generate_models
        if (behavior == :invoke && model_exists?) || (behavior == :revoke && migration_exists?(table_name))
          #TODO: insert the appropriate lines in the existing model file
          #include Signature::SignatureDoc
          #has_many :tag_fields, dependent: :destroy, class_name: 'DocumentTag'
          #has_many :document_images, dependent: :destroy, class_name: 'DocumentImage'
          template 'doc_image_model.rb', File.join('app/models', class_path, "#{file_name. + '_image'}.rb")
          template 'doc_tag_model.rb', File.join('app/models', class_path, "#{file_name + '_tag'}.rb")
        end
        else
          # generate a custom model template
          template 'doc_model.rb', File.join('app/models', class_path, "#{file_name}.rb")
          template 'doc_image_model.rb', File.join('app/models', class_path, "#{file_name. + '_image'}.rb")
          template 'doc_tag_model.rb', File.join('app/models', class_path, "#{file_name + '_tag'}.rb")
      end

      def inject_signature_content
        content = model_contents

        class_path = if namespaced?
                       class_name.to_s.split("::")
                     else
                       [class_name]
                     end

        indent_depth = class_path.size - 1
        content = content.split("\n").map { |line| "  " * indent_depth + line } .join("\n") << "\n"

        #inject_into_class(model_path, class_path.last, content) if model_exists?
      end
    end
  end
end