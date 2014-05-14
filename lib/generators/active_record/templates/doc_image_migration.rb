class SignatureCreate<%= table_name.camelize.singularize %>Images < ActiveRecord::Migration
  def change
    create_table(:<%= table_name.singularize %>_images) do |t|
      ## Paperclip document fields
      t.string :image_file_name
      t.string :image_content_type
      t.integer :image_file_size
      t.datetime :image_updated_at

      t.references :<%= file_name %>
      t.integer :page

      <% attributes.each do |attribute| -%>
        t.<%= attribute.type %> :<%= attribute.name %>
      <% end -%>

      t.timestamps
    end
  end
end