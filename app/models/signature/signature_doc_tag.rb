require 'active_support/concern'

module Signature
  module SignatureDocTag
    extend ActiveSupport::Concern

    included do
      attr_accessible :height, :name, :value, :signature_document, :signature_document_image, :tag_type, :width, :x, :y, :page

      belongs_to :signature_document
      belongs_to :signature_document_image

      #from document_image - TODO: refactor constants
      RES_SCALE = 3
      RES = 72 * RES_SCALE # default pdf resolution is 72 dpi

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

    end

    def scaled_attributes
      return {
          x: self.x * RES_SCALE,
          y: self.y * RES_SCALE,
          height: self.height * RES_SCALE,
          width: self.width * RES_SCALE,
          tag_type: self.tag_type,
          page: self.page
      }

    end

  end
end