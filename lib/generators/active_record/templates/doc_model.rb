class <%= class_name %> < ActiveRecord::Base

  has_many :tag_fields, dependent: :destroy, class_name: '<%= class_name %>Tag'
  has_many :document_images, dependent: :destroy, class_name: '<%= class_name %>Image'

  include Signature::SignatureDoc

end