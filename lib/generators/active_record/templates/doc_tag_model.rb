class <%= class_name %>Tag < ActiveRecord::Base

  belongs_to :document, class_name: '<%= class_name %>'
  belongs_to :document_image, class_name: '<%= class_name %>Image'

  include Signature::SignatureDocTag

end