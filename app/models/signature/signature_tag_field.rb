class SignatureTagField < ActiveRecord::Base
  attr_accessible :height, :name, :signature_document, :signature_document_image, :tag_type, :width, :x, :y, :page

  belongs_to :signature_document
  belongs_to :signature_document_image

  TAG_TYPES = {
      signature: 'signature',
      text: 'text',
      checkbox: 'checkbox'
  }

  TAG_TYPES.each do |meth, index|
    define_method("#{meth}?") { tag_type == TAG_TYPES[index] }
  end


end