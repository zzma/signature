require 'active_support/concern'

module Signature
  module SignatureDocImage
    extend ActiveSupport::Concern

    included do
      attr_accessible :page, :signature_document, :image
      # TODO: don't store in public folder - create an authenticated route for downloading files
      has_attached_file :image,
                        :url => "/system/:rails_env/:class/:attachment/:id/:filename"

      validates_attachment_content_type :image, :content_type => /^image\/(png|gif|jpeg)/

      RES_SCALE = 3
      RES = 72 * RES_SCALE # default pdf resolution is 72 dpi
    end

  end
end