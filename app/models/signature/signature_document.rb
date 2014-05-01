require 'csv'

class SignatureDocument < ActiveRecord::Base
  attr_accessible :signed_at, :signed_ip, :id, :doc
  # TODO: don't store in public folder - create an authenticated route for downloading files
  # TODO? obfuscate the filename and url with https://github.com/thoughtbot/paperclip#uri-obfuscation
  has_attached_file :doc
  validates_attachment_content_type :doc, :content_type => 'application/pdf'

  PDF2TXT = 'pdf2txt.py'
  IMAGEMAGICK = 'convert'
  GHOSTSCRIPT = 'gs'
  RES_SCALE = 3
  RES = 72 * RES_SCALE # default pdf resolution is 72 dpi
  WIDTH_BUFFER = 3 # additional width added to the tag fields

  has_many :signature_document_images, dependent: :destroy
  has_many :signature_tag_fields, dependent: :destroy

  # TODO: update sequence of events after SignatureDocument upload/creation
  # 1) Detect Signature Fields (cache this?)
  # 2) Use Prawn to cover them with white rectangles
  # 3) Convert the PDF's to PNG's
  # 4) Hook up tag fields to signature document images

  #after_create :process_tag_fields
  #after_create :generate_document_images
  #before_create :generate_document_images

  # TODO: check if the required executables are present PDF2TXT, IMAGEMAGICK
  #TODO: before_save that checks if the doc has been updated, and updates the document images accordingly

  # create signature_tag_fields
  def process_tag_fields
    if self.signature_tag_fields.blank?
      tmp_csv_file = Rails.root.to_s + '/tmp/' + self.doc_file_name.gsub(/\.pdf/, '.csv')
      removeCsv = Cocaine::CommandLine.new('rm', tmp_csv_file)

      line = Cocaine::CommandLine.new(PDF2TXT, '-t tag -o :csv_output_file :pdf_input_file')
      begin
        line.run(:csv_output_file => tmp_csv_file,
                 :pdf_input_file => self.doc.path)
      rescue Cocaine::ExitStatusError => e
        removeCsv.run
        e
      end

      CSV.foreach(tmp_csv_file) do |row|
        attr = {
            page: row[0].to_i,
            x: row[1].to_f * RES_SCALE,
            y: row[2].to_f * RES_SCALE,
            width: (row[3].to_f - row[1].to_f + WIDTH_BUFFER) * RES_SCALE ,
            height: (row[4].to_f - row[2].to_f) * RES_SCALE,
            name: parse_tag_name(row[5]),
            tag_type: get_tag_type(row[5])
        }

        self.signature_tag_fields.create(attr)
      end

      if self.signature_document_images.present?
        connect_tags_to_images
      end

      removeCsv.run

    end
  end

  # Convert the PDF document into a series of signature_document_images
  def generate_document_images
  #  convert -density 200 -quality 80 file.pdf file.png
    image_file = self.doc.path.gsub(/\.pdf/, '.png')

    line = Cocaine::CommandLine.new(GHOSTSCRIPT, '-q -dNOPAUSE -dBATCH -sDEVICE=pngalpha -r' + RES.to_s + ' -sOutputFile=:image_file :pdf_file')
    line.run(:image_file => image_file.gsub(/\.png/, '-%d.png'), :pdf_file => self.doc.path)

    page_count = PDF::Reader.new(self.doc.path).page_count

    if page_count and page_count > 0
      filename = image_file.gsub(/\.png/, '')
      extension = '.png'
      for index in (1...page_count+1)
        self.signature_document_images.create(:image => File.new(filename + '-' + index.to_s + extension, 'r'), :page => index)
      end
    end

    # Handle the multiple image files that are created for multiple-page documents
    # create appropriate Signature Document Images
  end

  # Create a deep copy of the signature_document, with the appropriate signature_document_images
  # and signature_tag_fields
  def deep_copy

  end

  # Create a semi-deep copy of the signature_document, with only the signature_tag_fields
  def copy_with_tag_fields

  end

  # Apply tags to the signature document
  def apply_tags(tags)

  end

  private

  # Handle tag names of the form {{!tag_name}} and parse them to tag_name
  # Logs a warning if the tag name is of improper form
  def parse_tag_name(str)
    tag_name = str.gsub(/^.*\{\{!(?<tag>.*)\}\}.*$/,'\k<tag>')
    if tag_name == str
      Rails.logger.warn('Improper tag name: ' + str)
      tag_name
    else
      tag_name
    end
  end

  # Determine tag type
  def get_tag_type(str)
    # TODO: add the ability to handle checkbox fields
    if parse_tag_name(str).split(':')[-1] == 'signature'
      return SignatureTagField::TAG_TYPES[:signature]
    else
      return SignatureTagField::TAG_TYPES[:text]
    end
  end

  # Connect a signature document's tags to its document images
  def connect_tags_to_images
    tag_fields = self.signature_tag_fields
    images = self.signature_document_images

    if images.present? and tag_fields.present?
      tag_fields.each do |tag|
        tag.update_attributes(signature_document_image: self.signature_document_images.where(page: tag.page).first)
      end
    else
      Rails.logger.warn('No images and/or tags to connect for Signature Doc id: ' + self.id.to_s)
      return
    end

  end

end