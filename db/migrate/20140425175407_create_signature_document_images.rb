class CreateSignatureDocumentImages < ActiveRecord::Migration
  def change
    create_table :signature_document_images do |t|
      t.references :signature_document
      t.integer :page
      t.string :image_file_name
      t.string :image_content_type
      t.integer :image_file_size
      t.datetime :image_updated_at

      t.timestamps
    end
  end
end
