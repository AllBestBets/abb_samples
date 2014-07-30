# config valid only for Capistrano 3.1
lock '3.2.1'

set :application, 'abb_samples'
set :repo_url, 'git@github.com:AllBestBets/abb_samples.git'

ask :branch, :master
set :user, 'abb_samples'
set :deploy_to, -> { "/home/#{fetch(:user)}" }
set :keep_releases, 100
set :scm, :git

set :format, :pretty
set :log_level, :debug
set :pty, true

set :ssh_options, {
    user: fetch(:user),
    keys: %w(~/.ssh/id_rsa),
    forward_agent: true
}
