require 'active_support/concern'

module Signature
  module SignatureDocTag
    extend ActiveSupport::Concern

    included do
      attr_accessible :height, :name, :value, :document, :document_image, :tag_type, :width, :x, :y, :page

      TAG_TYPES = Signature::Constants::TAG_TYPES
      RES_SCALE = Signature::Constants::RES_SCALE

      TAG_TYPES.each do |meth, index|
        define_method("#{meth}?") { tag_type == TAG_TYPES[meth] }
      end

      scope :not_signature, lambda { where("tag_type != '" + TAG_TYPES[:signature]  + "'")}
      scope :signature, lambda { where("tag_type = '" + TAG_TYPES[:signature]  + "'")}

    end

    def scaled_attributes
      height_adjust = (self.tag_type == TAG_TYPES[:signature]) ? 8 : 0
      return {
          id: self.id,
          x: self.x * RES_SCALE,
          y: self.y * RES_SCALE,
          height: (self.height + height_adjust) * RES_SCALE,
          width: self.width * RES_SCALE,
          tag_type: self.tag_type,
          page: self.page,
          name: self.name,
          value: self.value
      }

    end

  end
end