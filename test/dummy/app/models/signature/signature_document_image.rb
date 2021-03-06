class SignatureDocumentImage < ActiveRecord::Base
  attr_accessible :page, :signature_document, :image
  # TODO: don't store in public folder - create an authenticated route for downloading files
  has_attached_file :image
  validates_attachment_content_type :image, :content_type => /^image\/(png|gif|jpeg)/

  RES_SCALE = 3
  RES = 72 * RES_SCALE # default pdf resolution is 72 dpi

  belongs_to :signature_document
  has_many :signature_tag_fields
end
