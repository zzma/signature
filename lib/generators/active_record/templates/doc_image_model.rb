class <%= class_name %>Image < ActiveRecord::Base

  has_many :tag_fields, class_name: '<%= class_name %>Tag'
  belongs_to :document, class_name: '<%= class_name %>'

  include Signature::SignatureDocImage

end