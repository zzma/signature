class SignatureCreate<%= table_name.camelize.singularize %>Tags < ActiveRecord::Migration
  def change
    create_table(:<%= table_name.singularize %>_tags) do |t|
      t.string :name
      t.string :value
      t.float :x
      t.float :y
      t.float :width
      t.float :height
      t.string :tag_type
      t.integer :page
      t.boolean :white_bg

      t.references :<%= file_name %>
      t.references :<%= file_name %>_image

      <% attributes.each do |attribute| -%>
        t.<%= attribute.type %> :<%= attribute.name %>
      <% end -%>

      t.timestamps
    end
  end
end