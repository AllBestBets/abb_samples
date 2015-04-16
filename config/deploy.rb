# config valid only for Capistrano 3.1
lock '3.2.1'

set :application, 'samples.allbestbets.ru'
set :repo_url, 'git@github.com:AllBestBets/abb_samples.git'

ask :branch, :master
set :user, 'samples.allbestbets.ru'
set :deploy_to, -> { "/var/www/#{fetch(:user)}" }
set :keep_releases, 100
set :scm, :git

set :format, :pretty
set :log_level, :debug
set :pty, true

set :copy_exclude, %w(.git .gitignore config Capfile)

set :ssh_options, {
    user: fetch(:user),
    keys: %w(~/.ssh/id_rsa),
    forward_agent: true
}
