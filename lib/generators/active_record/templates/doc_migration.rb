class SignatureCreate<%= table_name.camelize %> < ActiveRecord::Migration
  def change
    create_table(:<%= table_name %>) do |t|
      ## Paperclip document fields
      t.string :doc_file_name, null: false, default: ""
      t.string :doc_content_type, null: false, default: ""
      t.integer :doc_file_size
      t.datetime :doc_updated_at

      ## Tracking
      t.string   :signed_ip
      t.datetime :signed_at

      ## status field
      t.boolean :has_summary

      <% attributes.each do |attribute| -%>
        t.<%= attribute.type %> :<%= attribute.name %>
      <% end -%>

      t.timestamps
    end
  end
end