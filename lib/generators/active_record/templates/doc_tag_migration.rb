class SignatureCreate<%= table_name.camelize.singularize %>Tags < ActiveRecord::Migration
  def change
    create_table(:<%= table_name.singularize %>_tags) do |t|
      t.string :name
      t.string :value
      t.integer :x
      t.integer :y
      t.integer :width
      t.integer :height
      t.string :tag_type
      t.integer :page

      t.references :<%= file_name %>
      t.references :<%= file_name %>_image

      <% attributes.each do |attribute| -%>
        t.<%= attribute.type %> :<%= attribute.name %>
      <% end -%>

      t.timestamps
    end
  end
end