require 'csv'
require 'date'

class SignatureDocument < ActiveRecord::Base
  attr_accessible :signed_at, :signed_ip, :id, :doc
  # TODO: don't store in public folder - create an authenticated route for downloading files
  # TODO? obfuscate the filename and url with https://github.com/thoughtbot/paperclip#uri-obfuscation
  has_attached_file :doc
  validates_attachment_content_type :doc, :content_type => 'application/pdf'

  PDF2TXT = 'pdf2txt.py'
  IMAGEMAGICK = 'convert'
  GHOSTSCRIPT = 'gs'

  DRAWN_SIG = 'sig'
  TYPED_SIG = 'text'

  WIDTH_BUFFER = 2 # additional width added to the tag fields
  HEIGHT_BUFFER = 2 # additional height added to the tag fields

  has_many :signature_tag_fields, dependent: :destroy
  has_many :signature_document_images, dependent: :destroy

  after_commit :process_document, :on => :create

  # TODO: check if the required executables are present PDF2TXT, IMAGEMAGICK, GHOSTSCRIPT
  # TODO: before_save that checks if the doc has been updated, and updates the document images accordingly

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
            x: row[1].to_f,
            y: row[2].to_f,
            width: (row[3].to_f - row[1].to_f + WIDTH_BUFFER),
            height: (row[4].to_f - row[2].to_f),
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
    #remove the current document images
    self.signature_document_images.map(&:destroy)

    #  convert -density 200 -quality 80 file.pdf file.png
    image_file = self.doc.path.gsub(/\.pdf/, '.png')

    line = Cocaine::CommandLine.new(GHOSTSCRIPT, '-q -dNOPAUSE -dBATCH -sDEVICE=pngalpha -r' + SignatureDocumentImage::RES.to_s + ' -sOutputFile=:image_file :pdf_file')
    line.run(:image_file => image_file.gsub(/\.png/, '-%d.png'), :pdf_file => self.doc.path)

    page_count = PDF::Reader.new(self.doc.path).page_count

    if page_count and page_count > 0
      filename = image_file.gsub(/\.png/, '')
      extension = '.png'
      for index in (1...page_count+1)
        self.signature_document_images.create(:image => File.new(filename + '-' + index.to_s + extension, 'r'), :page => index)
      end
    end

    if self.signature_tag_fields.present?
      connect_tags_to_images
    end
  end

  # Create a deep copy of the signature_document, with the appropriate signature_document_images
  # and signature_tag_fields
  def deep_copy

  end

  # Create a semi-deep copy of the signature_document, with only the signature_tag_fields
  def copy_with_tag_fields

  end

  # Apply existing tags to the signature document
  # Accepts a hash of {tag_name1: value1, tag_name2: value2, ...}
  def apply_tags(tags=nil)
    if tags
      tag_fields = self.signature_tag_fields
      tags.each do |tag_name, value|
        field = tag_fields.select{|tf| tf.name == tag_name.to_s}
        if field.present? and field.length == 1
          field.first.update_attributes(value: value)
        end
      end
    end

    populate_tags
    generate_document_images
  end

  def hide_text_tags
    populate_tags(set_blank: TRUE)
  end

  def add_signature(sig_type, data, ip_address)
    sig_file = self.doc.path.gsub(/\.pdf/, '-drawn-signature.png')
    if sig_type == DRAWN_SIG
      File.open(sig_file, 'wb') do |f|
        f.write(Base64.decode64(data.split(',')[1]))
      end
    end


    output = self.doc.path.gsub(/\.pdf/, '-signed.pdf')
    input = self.doc.path
    page_count = PDF::Reader.new(input).page_count

    begin
      Prawn::Document.generate(output, :skip_page_creation => true) do |pdf|
        page_count.times do |num|
          pdf.start_new_page(:template => input, :template_page => num+1)

          tag_fields = self.signature_tag_fields.where(page: num+1).signature
          if tag_fields.present?
            tag_fields.each do |tag|
              pdf.canvas do
                #White rectangle to 'erase' previous signature
                pdf.fill_color 'ffffff'
                pdf.fill_rectangle([tag.x, tag.y + tag.height], tag.width, tag.height + HEIGHT_BUFFER)
                pdf.fill_color '000000'

                if sig_type == DRAWN_SIG
                  # Overlay the drawn signature on top of the signature field
                  pdf.image(sig_file, at: [tag.x, tag.y + tag.height], fit: [tag.width, tag.height])
                elsif sig_type == TYPED_SIG

                  # Upload custom font
                  #pdf.font_families.update('Calligraffitti' => {
                  #    :normal => "#{Rails.root}/app/assets/fonts/signature/Calligraffitti-Regular.ttf"
                  #})

                  # Place the typed Signature on top of the signature field
                  pdf.font("#{Rails.root}/app/assets/fonts/signature/pilgiche.ttf") do
                  #pdf.font("/Library/Fonts/pilgiche.ttf") do
                    pdf.text_box data, at: [tag.x, tag.y + tag.height], height: tag.height + HEIGHT_BUFFER, size: tag.height, valign: :center
                  end
                end
              end
            end
          end
        end
      end
    rescue
      puts '****SOME ERROR IN add_signature!******'
    end

    replace_file(output, input)

    record_signature(ip_address)
    generate_document_images
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

  # fill in the signature tag fields on the pdf with values
  # accepts options[:set_blank], which leaves the field empty with a white background
  def populate_tags(options = {})
    output = self.doc.path.gsub(/\.pdf/, '-tagged.pdf')
    input = self.doc.path
    page_count = PDF::Reader.new(input).page_count

    begin
      Prawn::Document.generate(output, :skip_page_creation => true) do |pdf|
        page_count.times do |num|
          pdf.start_new_page(:template => input, :template_page => num+1)

          tag_fields = self.signature_tag_fields.where(page: num+1)
          if tag_fields.present?
            tag_fields.each do |tag|
              pdf.canvas do
                pdf.fill_color 'ffffff'
                pdf.fill_rectangle([tag.x, tag.y + tag.height], tag.width, tag.height + HEIGHT_BUFFER)
                unless options && options[:set_blank]
                  pdf.fill_color '000000'
                  pdf.text_box(tag.value || tag.tag_type.upcase + ' FIELD',
                               at: [tag.x, tag.y + tag.height],
                               height: tag.height + HEIGHT_BUFFER,
                               valign: :center) if !tag.signature?
                end
              end
            end
          end
        end
      end
    rescue
      puts '****SOME ERROR IN populate_tags!******'
    end

    replace_file(output, input)
  end

  def replace_file(replacing_file, replaced_file)
    line = Cocaine::CommandLine.new('mv', ':new_file :original_file')
    begin
      line.run(:new_file => replacing_file, :original_file => replaced_file)
    rescue Cocaine::ExitStatusError => e
      Rails.logger.error(e)
    end
  end

  def record_signature(ip_address)
    self.update_attributes(signed_at: Time.now, signed_ip: ip_address)
  end

  def process_document
    process_tag_fields
    hide_text_tags
    generate_document_images
  end

end