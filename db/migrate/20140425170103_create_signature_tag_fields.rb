class CreateSignatureTagFields < ActiveRecord::Migration
  def change
    create_table :signature_tag_fields do |t|
      t.string :name
      t.string :value
      t.references :signature_document
      t.references :signature_document_image
      t.integer :x
      t.integer :y
      t.integer :width
      t.integer :height
      t.string :tag_type
      t.integer :page

      t.timestamps
    end
  end
end
