class SignatureTagField < ActiveRecord::Base
  attr_accessible :height, :name, :value, :signature_document, :signature_document_image, :tag_type, :width, :x, :y, :page

  belongs_to :signature_document
  belongs_to :signature_document_image

  TAG_TYPES = {
      signature: 'signature',
      text: 'text',
      checkbox: 'checkbox'
  }

  TAG_TYPES.each do |meth, index|
    define_method("#{meth}?") { tag_type == TAG_TYPES[meth] }
  end

  scope :not_signature, lambda { where("tag_type != '" + TAG_TYPES[:signature]  + "'")}
  scope :signature, lambda { where("tag_type = '" + TAG_TYPES[:signature]  + "'")}

  def scaled_attributes
    return {
        x: self.x * SignatureDocumentImage::RES_SCALE,
        y: self.y * SignatureDocumentImage::RES_SCALE,
        height: self.height * SignatureDocumentImage::RES_SCALE,
        width: self.width * SignatureDocumentImage::RES_SCALE,
        tag_type: self.tag_type,
        page: self.page
    }

  end
end