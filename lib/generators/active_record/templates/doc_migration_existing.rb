class AddSignatureTo<%= table_name.camelize %> < ActiveRecord::Migration
  def change
    add_column :<%= table_name %>, :signed_ip, :string
    add_column :<%= table_name %>, :signed_at, :datetime
    add_column :<%= table_name %>, :has_summary, :boolean
  end
end