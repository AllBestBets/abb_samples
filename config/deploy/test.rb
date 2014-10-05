set :stage, :test

role :app, %w{lb1.3bagels.com}
server 'lb1.3bagels.com', user: 'samples.allbestbets.ru', roles: %w{app}, port: 65321
