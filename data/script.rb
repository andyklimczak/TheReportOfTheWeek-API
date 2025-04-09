require 'json'
require 'date'
require 'securerandom'

date_regex = /=new Date\((\d+), (\d+), (\d+)\)/

reports = []
File.open('reports.json') do |f|
  data = JSON.load(f)
  data['reports'].each do |r|
    puts r
    r['id'] = SecureRandom.uuid
    year, month, date = r['dateReleased'].match(date_regex).captures
    new_date = Date.new(year.to_i, month.to_i + 1, date.to_i)
    r['rating'] = r['rating'].to_f if r['rating']
    r['dateReleased'] = new_date.strftime("%Y-%m-%d")
    reports << r
  end
end

result = { reports: reports }
File.open('reports2.json', 'w') do |f|
  f.write(JSON.pretty_generate(result))
end
