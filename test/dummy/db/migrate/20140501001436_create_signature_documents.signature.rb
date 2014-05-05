# This migration comes from signature (originally 20140428223227)
class CreateSignatureDocuments < ActiveRecord::Migration
  def change
    create_table :signature_documents do |t|
      t.datetime :signed_at
      t.string :signed_ip
      t.string :doc_file_name
      t.string :doc_content_type
      t.integer :doc_file_size
      t.datetime :doc_updated_at

      t.timestamps
    end
  end
end
